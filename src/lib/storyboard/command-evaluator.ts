import { SbCommand, SbLoop, INFINITE_DURATION } from "../sbParser/types";
import { applyEasing } from "./easing";
import { getLoopCommandValue, getLoopOpacity, getLoopFlipState } from "./loop-evaluator";

// ============================================
// Generic Command Sequence Evaluator
// ============================================

interface LoopResult<T> {
  value: T;
  startTime: number;
  endTime: number;
}

/**
 * Callbacks for handling different command states in the evaluation pipeline.
 * Used by `evaluateSequence` to avoid duplicating the
 * "latest startTime wins" pattern across property types.
 */
interface CommandHandler<T> {
  /** Handle infinite-duration command */
  handleInfinite: (cmd: SbCommand, time: number) => T;
  /** Handle currently active command */
  handleActive: (cmd: SbCommand, time: number) => T;
  /** Handle last ended command (return end value) */
  handleEnded: (cmd: SbCommand) => T;
  /** Handle pre-read (first command's start value) */
  handlePreRead: (cmd: SbCommand) => T;
  /** Default when no commands or loops apply */
  defaultValue: T;
}

/**
 * Evaluate a sequence of commands using the flat "latest startTime wins" rule.
 *
 * osu! behavior (from StoryboardSprite.ApplyTransforms):
 * 1. All commands (direct + loop iterations) are evaluated flat
 * 2. The command with the latest StartTime at any given time determines the value
 * 3. Direct commands and loop commands are compared by their effective startTime
 */
function evaluateSequence<T>(
  commands: SbCommand[],
  loops: SbLoop[],
  currentTime: number,
  commandType: string,
  handler: CommandHandler<T>,
  loopReader: (loops: SbLoop[], time: number) => LoopResult<T> | null,
): T {
  const filtered = commands
    .filter((cmd) => cmd.type === commandType)
    .sort((a, b) => a.startTime - b.startTime);

  if (filtered.length === 0 && loops.length === 0) {
    return handler.defaultValue;
  }

  // Find the direct command with latest startTime <= currentTime
  let latestDirect: SbCommand | null = null;
  for (let i = filtered.length - 1; i >= 0; i--) {
    if (filtered[i].startTime <= currentTime) {
      latestDirect = filtered[i];
      break;
    }
  }

  // Check infinite duration first (immediate return)
  if (latestDirect?.endTime === INFINITE_DURATION) {
    return handler.handleInfinite(latestDirect, currentTime);
  }

  // Get loop result with timing info
  const loopResult = loops.length > 0 ? loopReader(loops, currentTime) : null;

  // Compare by latest startTime
  const directStartTime = latestDirect?.startTime ?? -Infinity;
  const loopStartTime = loopResult?.startTime ?? -Infinity;

  if (loopStartTime > directStartTime && loopResult) {
    // Loop command iteration has later startTime → loop wins
    return loopResult.value;
  }

  if (latestDirect) {
    // Direct command wins
    if (currentTime <= latestDirect.endTime) {
      return handler.handleActive(latestDirect, currentTime);
    }
    return handler.handleEnded(latestDirect);
  }

  if (loopResult) {
    // Only loop command available
    return loopResult.value;
  }

  // No command has started yet → pre-read
  if (filtered.length > 0 && currentTime < filtered[0].startTime) {
    return handler.handlePreRead(filtered[0]);
  }

  return handler.defaultValue;
}

const SRGB_TO_LINEAR_THRESHOLD = 0.04045;

/** Convert sRGB channel value to linear space */
function srgbToLinear(c: number): number {
  if (c === 1) return 1;
  return c <= SRGB_TO_LINEAR_THRESHOLD ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function interpolateWithEasing(
  startTime: number,
  endTime: number,
  startValue: number,
  endValue: number,
  currentTime: number,
  easing: number,
): number {
  if (currentTime <= startTime) return startValue;
  if (currentTime >= endTime) return endValue;
  const duration = endTime - startTime;
  if (duration === 0) return endValue; // Instant change: use endValue (osu! behavior)
  const t = (currentTime - startTime) / duration;
  return startValue + (endValue - startValue) * applyEasing(t, easing);
}

function getCommandValue(
  cmd: SbCommand,
  currentTime: number,
  paramIndex: number,
): number {
  if (cmd.params.length === 0) return 0;
  if (cmd.params.length === 1) return cmd.params[0];

  const startValue = cmd.params[paramIndex];

  // Determine end value index based on command type
  let endIndex: number;
  switch (cmd.type) {
    case "M": // Move: x1, y1, x2, y2 (paramIndex 0->2, 1->3)
    case "V": // Vector Scale: x1, y1, x2, y2 (同 Move)
      endIndex = paramIndex + 2;
      break;
    case "MX": // MoveX: x1, x2 (paramIndex 0->1)
    case "MY": // MoveY: y1, y2 (paramIndex 0->1)
      endIndex = paramIndex + 1;
      break;
    case "C": // Color: r1, g1, b1, r2, g2, b2 (paramIndex 0->3, 1->4, 2->5)
      endIndex = paramIndex + 3;
      break;
    default: // F, S, R 等: start, end (paramIndex 0->1)
      endIndex = paramIndex + 1;
      break;
  }

  const endValue = cmd.params[endIndex] ?? startValue;
  return interpolateWithEasing(
    cmd.startTime,
    cmd.endTime,
    startValue,
    endValue,
    currentTime,
    cmd.easing,
  );
}

export function getOpacity(
  commands: SbCommand[],
  loops: SbLoop[],
  currentTime: number,
): number {
  return evaluateSequence(
    commands,
    loops,
    currentTime,
    "F",
    {
      handleInfinite: (cmd, time) => getCommandValue(cmd, time, 0),
      handleActive: (cmd, time) => getCommandValue(cmd, time, 0),
      handleEnded: (cmd) => cmd.params[1] ?? cmd.params[0] ?? 0,
      handlePreRead: (cmd) => cmd.params[0] ?? 0,
      defaultValue: 1,
    },
    getOpacityFromLoops,
  );
}

export function getPosition(
  commands: SbCommand[],
  loops: SbLoop[],
  currentTime: number,
  defaultX: number,
  defaultY: number,
): { x: number; y: number } {
  let x = defaultX,
    y = defaultY;
  let lastDirectXTime = -Infinity;
  let lastDirectYTime = -Infinity;

  const mCommands = commands
    .filter((cmd) => cmd.type === "M" || cmd.type === "MX" || cmd.type === "MY")
    .sort((a, b) => a.startTime - b.startTime);

  for (const cmd of mCommands) {
    if (currentTime >= cmd.startTime && currentTime <= cmd.endTime) {
      // Command is active - use interpolated value
      if (cmd.type === "M" || cmd.type === "MX") {
        x = getCommandValue(cmd, currentTime, 0);
        lastDirectXTime = cmd.startTime;
      }
      if (cmd.type === "M" || cmd.type === "MY") {
        y = getCommandValue(cmd, currentTime, cmd.type === "M" ? 1 : 0);
        lastDirectYTime = cmd.startTime;
      }
    } else if (
      currentTime > cmd.endTime &&
      cmd.endTime !== INFINITE_DURATION
    ) {
      // Command has ended - use end value
      if (cmd.type === "M") {
        x = cmd.params[2] ?? cmd.params[0] ?? defaultX;
        y = cmd.params[3] ?? cmd.params[1] ?? defaultY;
        lastDirectXTime = cmd.startTime;
        lastDirectYTime = cmd.startTime;
      } else if (cmd.type === "MX") {
        x = cmd.params[1] ?? cmd.params[0] ?? defaultX;
        lastDirectXTime = cmd.startTime;
      } else if (cmd.type === "MY") {
        y = cmd.params[1] ?? cmd.params[0] ?? defaultY;
        lastDirectYTime = cmd.startTime;
      }
    } else if (
      cmd.endTime === INFINITE_DURATION &&
      currentTime >= cmd.startTime
    ) {
      // Infinite duration command
      if (cmd.type === "M" || cmd.type === "MX") {
        x = cmd.params[0] ?? defaultX;
        lastDirectXTime = cmd.startTime;
      }
      if (cmd.type === "M" || cmd.type === "MY") {
        y = cmd.params[cmd.type === "M" ? 1 : 0] ?? defaultY;
        lastDirectYTime = cmd.startTime;
      }
    } else if (currentTime < cmd.startTime) {
      // Pre-read: use command start value before it starts
      if (x === defaultX && (cmd.type === "M" || cmd.type === "MX"))
        x = cmd.params[0] ?? defaultX;
      if (y === defaultY && (cmd.type === "M" || cmd.type === "MY"))
        y = cmd.params[cmd.type === "M" ? 1 : 0] ?? defaultY;
      // Pre-read values should not update lastDirectXTime/lastDirectYTime
      // because the command hasn't actually started yet
    }
  }

  // Compare with loops - only override if loop's command started later
  if (loops.length > 0) {
    const loopX = getLoopCommandValue(loops, "M", currentTime, 0);
    const loopY = getLoopCommandValue(loops, "M", currentTime, 1);

    if (loopX && loopX.startTime > lastDirectXTime) {
      x = loopX.value;
    }
    if (loopY && loopY.startTime > lastDirectYTime) {
      y = loopY.value;
    }
  }

  return { x, y };
}

export function getScale(
  commands: SbCommand[],
  loops: SbLoop[],
  currentTime: number,
): number {
  return evaluateSequence(
    commands,
    loops,
    currentTime,
    "S",
    {
      handleInfinite: (cmd, time) => getCommandValue(cmd, time, 0),
      handleActive: (cmd, time) => getCommandValue(cmd, time, 0),
      handleEnded: (cmd) => cmd.params[1] ?? cmd.params[0] ?? 1,
      handlePreRead: (cmd) => cmd.params[0] ?? 1,
      defaultValue: 1,
    },
    getScaleFromLoops,
  );
}

function getScaleFromLoops(
  loops: SbLoop[],
  currentTime: number,
): LoopResult<number> | null {
  if (loops.length === 0) return null;
  const result = getLoopCommandValue(loops, "S", currentTime, 0);
  if (!result) return null;
  return {
    value: result.value,
    startTime: result.startTime,
    endTime: result.endTime,
  };
}

export function getVectorScale(
  commands: SbCommand[],
  loops: SbLoop[],
  currentTime: number,
): { x: number; y: number } | null {
  const result = evaluateSequence(
    commands,
    loops,
    currentTime,
    "V",
    {
      handleInfinite: (cmd, time) => ({
        x: getCommandValue(cmd, time, 0),
        y: getCommandValue(cmd, time, 1),
      }),
      handleActive: (cmd, time) => ({
        x: getCommandValue(cmd, time, 0),
        y: getCommandValue(cmd, time, 1),
      }),
      handleEnded: (cmd) => ({
        x: cmd.params[2] ?? cmd.params[0] ?? 1,
        y: cmd.params[3] ?? cmd.params[1] ?? 1,
      }),
      handlePreRead: (cmd) => ({
        x: cmd.params[0] ?? 1,
        y: cmd.params[1] ?? 1,
      }),
      defaultValue: { x: 1, y: 1 },
    },
    getVectorScaleFromLoops,
  );
  return result;
}

function getVectorScaleFromLoops(
  loops: SbLoop[],
  currentTime: number,
): LoopResult<{ x: number; y: number }> | null {
  if (loops.length === 0) return null;
  const loopX = getLoopCommandValue(loops, "V", currentTime, 0);
  const loopY = getLoopCommandValue(loops, "V", currentTime, 1);
  if (loopX && loopY) {
    return {
      value: { x: loopX.value, y: loopY.value },
      startTime: Math.max(loopX.startTime, loopY.startTime),
      endTime: Math.max(loopX.endTime, loopY.endTime),
    };
  }
  return null;
}

export function getRotation(
  commands: SbCommand[],
  loops: SbLoop[],
  currentTime: number,
): number {
  return evaluateSequence(
    commands,
    loops,
    currentTime,
    "R",
    {
      handleInfinite: (cmd, time) => getCommandValue(cmd, time, 0),
      handleActive: (cmd, time) => getCommandValue(cmd, time, 0),
      handleEnded: (cmd) => cmd.params[1] ?? cmd.params[0] ?? 0,
      handlePreRead: (cmd) => cmd.params[0] ?? 0,
      defaultValue: 0,
    },
    getRotationFromLoops,
  );
}

function getRotationFromLoops(
  loops: SbLoop[],
  currentTime: number,
): LoopResult<number> | null {
  if (loops.length === 0) return null;
  const result = getLoopCommandValue(loops, "R", currentTime, 0);
  if (!result) return null;
  return {
    value: result.value,
    startTime: result.startTime,
    endTime: result.endTime,
  };
}

/**
 * Compute interpolated color at a given time for an active command.
 * Converts sRGB to linear space for gamma-correct blending.
 */
function computeLinearColor(
  cmd: SbCommand,
  currentTime: number,
): { r: number; g: number; b: number } {
  const rSrgb = getCommandValue(cmd, currentTime, 0) / 255;
  const gSrgb = getCommandValue(cmd, currentTime, 1) / 255;
  const bSrgb = getCommandValue(cmd, currentTime, 2) / 255;
  return {
    r: srgbToLinear(rSrgb),
    g: srgbToLinear(gSrgb),
    b: srgbToLinear(bSrgb),
  };
}

/**
 * Extract the end color value from a C command in linear space.
 * Uses params[3..5] if present, falls back to params[0..2].
 */
function computeLinearEndValue(
  cmd: SbCommand,
): { r: number; g: number; b: number } {
  const rSrgb = (cmd.params[3] ?? cmd.params[0]) / 255;
  const gSrgb = (cmd.params[4] ?? cmd.params[1]) / 255;
  const bSrgb = (cmd.params[5] ?? cmd.params[2]) / 255;
  return {
    r: srgbToLinear(rSrgb),
    g: srgbToLinear(gSrgb),
    b: srgbToLinear(bSrgb),
  };
}

/**
 * Extract the start color value from a C command in linear space.
 */
function computeLinearStartValue(
  cmd: SbCommand,
): { r: number; g: number; b: number } {
  const rSrgb = cmd.params[0] / 255;
  const gSrgb = cmd.params[1] / 255;
  const bSrgb = cmd.params[2] / 255;
  return {
    r: srgbToLinear(rSrgb),
    g: srgbToLinear(gSrgb),
    b: srgbToLinear(bSrgb),
  };
}

export function getColor(
  commands: SbCommand[],
  loops: SbLoop[],
  currentTime: number,
): { r: number; g: number; b: number } | null {
  const cCommands = commands.filter((cmd) => cmd.type === "C");
  if (cCommands.length === 0) {
    const loopColor = getColorFromLoops(loops, currentTime);
    return loopColor ? loopColor.value : null;
  }

  return evaluateSequence(
    commands,
    loops,
    currentTime,
    "C",
    {
      handleInfinite: (cmd, time) => computeLinearColor(cmd, time),
      handleActive: (cmd, time) => computeLinearColor(cmd, time),
      handleEnded: (cmd) => computeLinearEndValue(cmd),
      handlePreRead: (cmd) => computeLinearStartValue(cmd),
      defaultValue: { r: 1, g: 1, b: 1 },
    },
    getColorFromLoops,
  );
}

/**
 * Extract color from loop commands in linear space.
 * Returns null if no valid loop color found.
 */
function getColorFromLoops(
  loops: SbLoop[],
  currentTime: number,
): LoopResult<{ r: number; g: number; b: number }> | null {
  if (loops.length === 0) return null;

  const loopR = getLoopCommandValue(loops, "C", currentTime, 0);
  const loopG = getLoopCommandValue(loops, "C", currentTime, 1);
  const loopB = getLoopCommandValue(loops, "C", currentTime, 2);
  if (loopR && loopG && loopB) {
    return {
      value: {
        r: srgbToLinear(loopR.value / 255),
        g: srgbToLinear(loopG.value / 255),
        b: srgbToLinear(loopB.value / 255),
      },
      startTime: Math.max(loopR.startTime, loopG.startTime, loopB.startTime),
      endTime: Math.max(loopR.endTime, loopG.endTime, loopB.endTime),
    };
  }

  return null;
}

function getOpacityFromLoops(
  loops: SbLoop[],
  currentTime: number,
): LoopResult<number> | null {
  if (loops.length === 0) return null;
  return getLoopOpacity(loops, currentTime);
}

export function getFlipState(
  commands: SbCommand[],
  loops: SbLoop[],
  currentTime: number,
): { flipH: boolean; flipV: boolean; additive: boolean } {
  let flipH = false;
  let flipV = false;
  let additive = false;

  // Iterate through P commands, find the last one active at current time
  const pCommands = commands
    .filter((cmd) => cmd.type === "P" && cmd.paramStrings && cmd.paramStrings.length > 0)
    .sort((a, b) => a.startTime - b.startTime);

  for (const cmd of pCommands) {
    const param = cmd.paramStrings![0];
    if (currentTime >= cmd.startTime && currentTime <= cmd.endTime) {
      if (param === "H") flipH = true;
      else if (param === "V") flipV = true;
      else if (param === "A") additive = true;
    }
  }

  // Check loops for P commands
  if (loops.length > 0) {
    const loopFlip = getLoopFlipState(loops, currentTime);
    if (loopFlip) {
      flipH = flipH || loopFlip.flipH;
      flipV = flipV || loopFlip.flipV;
      additive = additive || loopFlip.additive;
    }
  }

  return { flipH, flipV, additive };
}

/**
 * Detect if V (Vector Scale) command returns negative values at the given time.
 * osu! uses negative scale to mirror sprites, which requires origin mirroring
 * (XOR with flipH/flipV).
 */
export function getNegativeScale(
  commands: SbCommand[],
  loops: SbLoop[],
  currentTime: number,
): { scaleXNeg: boolean; scaleYNeg: boolean } {
  const vScale = getVectorScale(commands, loops, currentTime);
  return {
    scaleXNeg: vScale !== null && vScale.x < 0,
    scaleYNeg: vScale !== null && vScale.y < 0,
  };
}

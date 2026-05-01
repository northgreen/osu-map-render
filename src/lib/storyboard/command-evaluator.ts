import { SbCommand, SbLoop, INFINITE_DURATION } from "../sbParser/types";
import { applyEasing } from "./easing";
import { getLoopCommandValue, getLoopOpacity, getLoopFlipState } from "./loop-evaluator";

// ============================================
// Generic Command Sequence Evaluator
// ============================================

/**
 * Callbacks for handling different command states in the evaluation pipeline.
 * Used by `evaluateSequence` to avoid duplicating the
 * "last active > last ended > pre-read > loops" pattern.
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
 * Evaluate a sequence of commands sorted by start time using the standard
 * osu! priority: **last active > last ended > pre-read > loops**.
 *
 * This eliminates duplication across `getScale`, `getVectorScale`,
 * `getRotation`, and `getColor`.
 */
function evaluateSequence<T>(
  commands: SbCommand[],
  loops: SbLoop[],
  currentTime: number,
  commandType: string,
  handler: CommandHandler<T>,
  loopReader: (loops: SbLoop[], time: number) => T | null,
): T {
  const filtered = commands
    .filter((cmd) => cmd.type === commandType)
    .sort((a, b) => a.startTime - b.startTime);

  if (filtered.length === 0) {
    return loopReader(loops, currentTime) ?? handler.defaultValue;
  }

  let lastEndedCmd: SbCommand | null = null;
  let lastActiveCmd: SbCommand | null = null;

  for (const cmd of filtered) {
    if (cmd.endTime === INFINITE_DURATION && currentTime >= cmd.startTime) {
      return handler.handleInfinite(cmd, currentTime);
    }

    if (currentTime >= cmd.startTime && currentTime <= cmd.endTime) {
      lastActiveCmd = cmd;
    }

    if (currentTime > cmd.endTime && cmd.endTime !== INFINITE_DURATION) {
      lastEndedCmd = cmd;
    }
  }

  // Priority: last active > last ended > pre-read > loops
  if (lastActiveCmd) {
    return handler.handleActive(lastActiveCmd, currentTime);
  }

  if (lastEndedCmd) {
    return handler.handleEnded(lastEndedCmd);
  }

  if (currentTime < filtered[0].startTime) {
    return handler.handlePreRead(filtered[0]);
  }

  return loopReader(loops, currentTime) ?? handler.defaultValue;
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

  // 根据命令类型确定结束值的索引
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
  // osu! behavior: sprites default to opacity 0 before any F command starts
  // F commands control visibility - sprite is invisible until first F command
  // This allows "fade in" effects where sprite starts invisible (F,...,0,1)

  let opacity = 0; // Default before any F command starts

  // Sort F commands by start time for proper sequential processing
  const fCommands = commands
    .filter((cmd) => cmd.type === "F")
    .sort((a, b) => a.startTime - b.startTime);

  if (fCommands.length === 0) {
    // No F commands - sprite is always visible
    opacity = 1;
  } else {
    // Find the earliest F command start time
    const earliestStartTime = fCommands[0].startTime;

    // Before the first F command starts, use the first command's start value
    // This allows fade-in effects to work correctly
    if (currentTime < earliestStartTime) {
      opacity = fCommands[0].params[0] ?? 0;
    }
  }

  // Process commands in time order - later commands override earlier ones
  for (const cmd of fCommands) {
    const isMaintain = cmd.params[1] === cmd.params[0]; // endValue = startValue means maintain

    if (currentTime >= cmd.startTime && currentTime <= cmd.endTime) {
      // Command is active - use interpolated value
      opacity = isMaintain
        ? cmd.params[0]
        : getCommandValue(cmd, currentTime, 0);
    } else if (
      currentTime > cmd.endTime &&
      cmd.endTime !== INFINITE_DURATION
    ) {
      // Command has ended - osu! behavior:
      // The alpha value persists until another F command overrides it,
      // BUT when currentTime exceeds the LAST F command's endTime,
      // the sprite is marked "not alive" and removed (not rendered at all).
      // This is handled by isObjectVisible, but we also need to ensure
      // opacity doesn't incorrectly stay at endValue for single-value F commands.
      // For single-value F commands (params[0] == params[1]), after the command ends,
      // the sprite should keep that value until another F command changes it.
      // The "not alive" logic in isObjectVisible will hide it after last command ends.
      opacity = cmd.params[1] ?? cmd.params[0] ?? 0;
    } else if (
      cmd.endTime === INFINITE_DURATION &&
      currentTime >= cmd.startTime
    ) {
      // Infinite duration command - use interpolated value
      opacity = isMaintain
        ? cmd.params[0]
        : getCommandValue(cmd, currentTime, 0);
    }
    // currentTime < cmd.startTime: don't change opacity (keep previous value)
  }

  // Also check loops for opacity values
  if (loops.length > 0) {
    const loopOpacityResult = getLoopOpacity(loops, currentTime);
    if (loopOpacityResult !== null) opacity = loopOpacityResult;
  }

  return opacity;
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

  const mCommands = commands
    .filter((cmd) => cmd.type === "M" || cmd.type === "MX" || cmd.type === "MY")
    .sort((a, b) => a.startTime - b.startTime);

  for (const cmd of mCommands) {
    if (currentTime >= cmd.startTime && currentTime <= cmd.endTime) {
      // Command is in progress - use interpolated value
      if (cmd.type === "M" || cmd.type === "MX")
        x = getCommandValue(cmd, currentTime, 0);
      if (cmd.type === "M" || cmd.type === "MY")
        y = getCommandValue(cmd, currentTime, cmd.type === "M" ? 1 : 0);
    } else if (
      currentTime > cmd.endTime &&
      cmd.endTime !== INFINITE_DURATION
    ) {
      // Command has ended - use end value
      // MX: params = [x1] or [x1, x2], end value is last param
      // MY: params = [y1] or [y1, y2], end value is last param
      // M: params = [x1, y1, x2, y2], end value is [2] and [3]
      if (cmd.type === "M") {
        x = cmd.params[2] ?? cmd.params[0] ?? defaultX;
        y = cmd.params[3] ?? cmd.params[1] ?? defaultY;
      } else if (cmd.type === "MX") {
        // For MX, end value is the last param (index 1 if exists, otherwise 0)
        x = cmd.params[1] ?? cmd.params[0] ?? defaultX;
      } else if (cmd.type === "MY") {
        // For MY, end value is the last param (index 1 if exists, otherwise 0)
        y = cmd.params[1] ?? cmd.params[0] ?? defaultY;
      }
    } else if (
      cmd.endTime === INFINITE_DURATION &&
      currentTime >= cmd.startTime
    ) {
      // Infinite duration command
      if (cmd.type === "M" || cmd.type === "MX") x = cmd.params[0] ?? defaultX;
      if (cmd.type === "M" || cmd.type === "MY")
        y = cmd.params[cmd.type === "M" ? 1 : 0] ?? defaultY;
    } else if (currentTime < cmd.startTime) {
      // Pre-read: use command start value before it starts (osu! behavior)
      // Only apply if no previous command has set the value (i.e., all commands are in the future)
      // This prevents pre-read from overriding active/ended command values
      // Process all future commands to find first M/MX for x and first M/MY for y
      if (x === defaultX && (cmd.type === "M" || cmd.type === "MX"))
        x = cmd.params[0] ?? defaultX;
      if (y === defaultY && (cmd.type === "M" || cmd.type === "MY"))
        y = cmd.params[cmd.type === "M" ? 1 : 0] ?? defaultY;
      // Only break if both x and y have been set (or this command could set both)
      const canSetX = cmd.type === "M" || cmd.type === "MX";
      const canSetY = cmd.type === "M" || cmd.type === "MY";
      if ((canSetX || x !== defaultX) && (canSetY || y !== defaultY)) {
        break;
      }
      // Otherwise, continue to find commands that can set remaining coordinates
    }
  }

  // Also check loops for position values
  if (loops.length > 0) {
    const loopX = getLoopCommandValue(loops, "M", currentTime, 0);
    const loopY = getLoopCommandValue(loops, "M", currentTime, 1);
    if (loopX !== null) x = loopX;
    if (loopY !== null) y = loopY;
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
): number | null {
  if (loops.length === 0) return null;
  return getLoopCommandValue(loops, "S", currentTime, 0);
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
): { x: number; y: number } | null {
  if (loops.length === 0) return null;
  const loopX = getLoopCommandValue(loops, "V", currentTime, 0);
  const loopY = getLoopCommandValue(loops, "V", currentTime, 1);
  if (loopX !== null && loopY !== null) {
    return { x: loopX, y: loopY };
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
): number | null {
  if (loops.length === 0) return null;
  return getLoopCommandValue(loops, "R", currentTime, 0);
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
    return getColorFromLoops(loops, currentTime);
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
): { r: number; g: number; b: number } | null {
  if (loops.length === 0) return null;

  const loopR = getLoopCommandValue(loops, "C", currentTime, 0);
  const loopG = getLoopCommandValue(loops, "C", currentTime, 1);
  const loopB = getLoopCommandValue(loops, "C", currentTime, 2);
  if (loopR !== null && loopG !== null && loopB !== null) {
    return {
      r: srgbToLinear(loopR / 255),
      g: srgbToLinear(loopG / 255),
      b: srgbToLinear(loopB / 255),
    };
  }

  return null;
}

// Calculate hue rotation angle from RGB color
export function calculateHue(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;

  if (max === min) {
    h = 0;
  } else if (max === r) {
    h = 60 * ((g - b) / (max - min));
  } else if (max === g) {
    h = 60 * ((b - r) / (max - min) + 2);
  } else {
    h = 60 * ((r - g) / (max - min) + 4);
  }

  return h < 0 ? h + 360 : h;
}

// Calculate saturation percentage from RGB color
export function calculateSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  if (max === 0) return 0;
  const s = (max - min) / max;
  return s * 100;
}

// Calculate brightness percentage from RGB color (average luminance)
export function calculateBrightness(r: number, g: number, b: number): number {
  // Use luminance formula: 0.299R + 0.587G + 0.114B
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance * 100;
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

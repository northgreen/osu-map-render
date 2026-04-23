import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Img,
  staticFile,
  Audio,
  interpolate,
} from "remotion";
import { useMemo, useState, useRef, useCallback } from "react";
import { SbObject, SbCommand, SbSample, SbLoop } from "./sbParser";
import storyboardData from "./storyboard.json";

// Easing interpolation functions (osu! supports 0-34)
function applyEasing(t: number, easing: number): number {
  switch (easing) {
    case 0:
      return t;
    case 1:
      return t * (2 - t);
    case 2:
      return t * t;
    case 3:
      return t * t;
    case 4:
      return t * (2 - t);
    case 5:
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    case 6:
      return t * t * t;
    case 7:
      return 1 - Math.pow(1 - t, 3);
    case 8:
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case 9:
      return t * t * t * t;
    case 10:
      return 1 - Math.pow(1 - t, 4);
    case 11:
      return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
    case 12:
      return t * t * t * t * t;
    case 13:
      return 1 - Math.pow(1 - t, 5);
    case 14:
      return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
    case 15:
      return 1 - Math.cos((t * Math.PI) / 2);
    case 16:
      return Math.sin((t * Math.PI) / 2);
    case 17:
      return -(Math.cos(Math.PI * t) - 1) / 2;
    case 18:
      return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
    case 19:
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    case 20:
      if (t === 0) return 0;
      if (t === 1) return 1;
      return t < 0.5
        ? Math.pow(2, 20 * t - 10) / 2
        : (2 - Math.pow(2, -20 * t + 10)) / 2;
    case 21:
      return 1 - Math.sqrt(1 - Math.pow(t, 2));
    case 22:
      return Math.sqrt(1 - Math.pow(t - 1, 2));
    case 23:
      if (t < 0.5) return (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2;
      return (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;
    case 24:
      if (t === 0 || t === 1) return t;
      return (
        -Math.pow(2, 10 * t - 10) *
        Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3))
      );
    case 25:
      if (t === 0 || t === 1) return t;
      return (
        Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) +
        1
      );
    case 26:
      if (t === 0 || t === 1) return t;
      return (
        Math.pow(2, -10 * t) * Math.sin((t * 20 - 0.75) * ((2 * Math.PI) / 3)) +
        1
      );
    case 27:
      if (t === 0 || t === 1) return t;
      return (
        Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 5)) +
        1
      );
    case 28:
      if (t === 0 || t === 1) return t;
      if (t < 0.5) {
        return (
          -(
            Math.pow(2, 20 * t - 10) *
            Math.sin((20 * t - 11.125) * ((2 * Math.PI) / 4.5))
          ) / 2
        );
      }
      return (
        (Math.pow(2, -20 * t + 10) *
          Math.sin((20 * t - 11.125) * ((2 * Math.PI) / 4.5))) /
          2 +
        1
      );
    case 29: {
      const c1 = 1.70158;
      return (c1 + 1) * t * t * t - c1 * t * t;
    }
    case 30: {
      const c4 = 1.70158;
      return 1 + c4 * Math.pow(t - 1, 3) + c4 * Math.pow(t - 1, 2);
    }
    case 31: {
      const c5 = 1.70158;
      const c2 = c5 * 1.525;
      if (t < 0.5) return (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2;
      return (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    }
    case 32:
      return 1 - bounceOut(1 - t);
    case 33:
      return bounceOut(t);
    case 34:
      if (t < 0.5) return (1 - bounceOut(1 - 2 * t)) / 2;
      return (1 + bounceOut(2 * t - 1)) / 2;
    default:
      return t;
  }
}

function bounceOut(t: number): number {
  const n1 = 7.5625,
    d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t - 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t - 2.25 / d1) * t + 0.9375;
  return n1 * (t - 2.625 / d1) * t + 0.984375;
}

// Get command value within loops - handles iteration timing
// Each iteration continues from where the previous one ended (continuous animation)
function getLoopCommandValue(
  loops: SbLoop[],
  cmdType: string,
  currentTime: number,
  paramIndex: number,
): number | null {
  for (const loop of loops) {
    // Check if current time is within this loop's active range
    if (currentTime < loop.startTime) continue;

    // Find minimum command start time in this loop (commands may not start at iteration 0)
    const minCmdStart = Math.min(...loop.commands.map((c) => c.startTime));

    // Calculate which iteration we're in, accounting for minCmdStart offset
    // Commands start at loop.startTime + minCmdStart in the first iteration
    const timeSinceFirstCmd = currentTime - loop.startTime - minCmdStart;
    if (timeSinceFirstCmd < 0) continue;

    const iteration = Math.floor(timeSinceFirstCmd / loop.loopDuration);
    // L,startTime,repeatCount 执行 repeatCount + 1 次（第一次 + repeatCount 次重复）
    // 所以最大有效 iteration = repeatCount
    if (loop.repeatCount > 0 && iteration > loop.repeatCount) continue;

    for (const cmd of loop.commands) {
      if (cmd.type !== cmdType) continue;

      // Calculate command time in this iteration
      // cmdStartAbs = loop.startTime + cmd.startTime + iteration * loopDuration
      const cmdStartAbs =
        loop.startTime + cmd.startTime + iteration * loop.loopDuration;

      // If endTime is infinite, command lasts until the next command in this iteration starts
      // Or until the end of this iteration
      let cmdEndAbs: number;
      if (cmd.endTime === Number.MAX_SAFE_INTEGER) {
        // Find the next command's start time in this iteration
        const nextCmd = loop.commands.find(
          (c) => c.startTime > cmd.startTime && c.type === cmdType,
        );
        if (nextCmd) {
          // Ends when next command starts (within this iteration)
          cmdEndAbs =
            loop.startTime + nextCmd.startTime + iteration * loop.loopDuration;
        } else {
          // No next command, ends at end of iteration
          cmdEndAbs =
            loop.startTime +
            cmd.startTime +
            (iteration + 1) * loop.loopDuration;
        }
      } else {
        cmdEndAbs =
          loop.startTime + cmd.endTime + iteration * loop.loopDuration;
      }

      const cmdDuration = cmdEndAbs - cmdStartAbs;

      if (currentTime >= cmdStartAbs && currentTime <= cmdEndAbs) {
        if (cmdDuration <= 0) continue;

        const relTimeInCmd = currentTime - cmdStartAbs;
        const t = relTimeInCmd / cmdDuration;

        const endIndex =
          cmdType === "M" ||
          cmdType === "MX" ||
          cmdType === "MY" ||
          cmdType === "V"
            ? paramIndex + 2
            : paramIndex + 1;
        const iterStartValue = cmd.params[paramIndex];
        const iterEndValue = cmd.params[endIndex] ?? iterStartValue;

        // Calculate value for this iteration only (no accumulation between iterations)
        const easedT = applyEasing(t, cmd.easing);
        return iterStartValue + (iterEndValue - iterStartValue) * easedT;
      }
    }
  }
  return null;
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

function getOpacity(
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
      cmd.endTime !== Number.MAX_SAFE_INTEGER
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
      cmd.endTime === Number.MAX_SAFE_INTEGER &&
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

// Get loop opacity - handles both active loops and loops that have finished
function getLoopOpacity(loops: SbLoop[], currentTime: number): number | null {
  let lastLoopOpacity: number | null = null;

  for (const loop of loops) {
    // Check if current time is within this loop's active range
    if (currentTime < loop.startTime) continue;

    // Find minimum command start time in this loop
    const minCmdStart = Math.min(
      ...loop.commands.filter((c) => c.type === "F").map((c) => c.startTime),
    );
    if (minCmdStart === undefined || minCmdStart === Infinity) continue;

    // Calculate which iteration we're in
    const timeSinceFirstCmd = currentTime - loop.startTime - minCmdStart;

    // Before loop commands execute, don't override opacity
    // Object uses default opacity (0 if it has commands, 1 if no F commands)
    // This prevents objects with absolute-time loop commands from being
    // visible during the long period before their commands execute
    if (timeSinceFirstCmd < 0) {
      continue;
    }

    const iteration = Math.floor(timeSinceFirstCmd / loop.loopDuration);

    // Check if loop is still active
    if (loop.repeatCount > 0 && iteration > loop.repeatCount) {
      // Loop has finished, use the final opacity from the last iteration
      const fCommand = loop.commands.find((c) => c.type === "F");
      if (fCommand) {
        const endValue = fCommand.params[1] ?? fCommand.params[0];
        lastLoopOpacity = endValue;
      }
      continue;
    }

    // Loop is active, get current opacity
    for (const cmd of loop.commands) {
      if (cmd.type !== "F") continue;

      const cmdStartAbs =
        loop.startTime + cmd.startTime + iteration * loop.loopDuration;
      const cmdEndAbs =
        loop.startTime + cmd.endTime + iteration * loop.loopDuration;

      if (currentTime >= cmdStartAbs && currentTime <= cmdEndAbs) {
        const cmdDuration = cmdEndAbs - cmdStartAbs;
        if (cmdDuration <= 0) continue;

        const relTimeInCmd = currentTime - cmdStartAbs;
        const t = relTimeInCmd / cmdDuration;
        const iterStartValue = cmd.params[0];
        const iterEndValue = cmd.params[1] ?? iterStartValue;
        lastLoopOpacity =
          iterStartValue +
          (iterEndValue - iterStartValue) * applyEasing(t, cmd.easing);
      }
    }
  }

  return lastLoopOpacity;
}

function getPosition(
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
        y = getCommandValue(cmd, currentTime, 0);
    } else if (
      currentTime > cmd.endTime &&
      cmd.endTime !== Number.MAX_SAFE_INTEGER
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
      cmd.endTime === Number.MAX_SAFE_INTEGER &&
      currentTime >= cmd.startTime
    ) {
      // Infinite duration command
      if (cmd.type === "M" || cmd.type === "MX") x = cmd.params[0] ?? defaultX;
      if (cmd.type === "M" || cmd.type === "MY") y = cmd.params[0] ?? defaultY;
    } else if (currentTime < cmd.startTime) {
      // Pre-read: use command start value before it starts (osu! behavior)
      // Only apply if we haven't already set a value from an active/ended command
      // Break after first future command to avoid subsequent commands overriding
      if (cmd.type === "M" || cmd.type === "MX") x = cmd.params[0] ?? defaultX;
      if (cmd.type === "M" || cmd.type === "MY") y = cmd.params[0] ?? defaultY;
      break; // Stop processing - all remaining commands are also in the future
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

function getScale(
  commands: SbCommand[],
  loops: SbLoop[],
  currentTime: number,
): number {
  let scale = 1;
  // 按时间排序 S 命令，确保正确处理多个命令
  const sCommands = commands
    .filter((cmd) => cmd.type === "S")
    .sort((a, b) => a.startTime - b.startTime);

  for (const cmd of sCommands) {
    if (currentTime >= cmd.startTime && currentTime <= cmd.endTime) {
      // 命令正在进行中，使用插值
      scale = getCommandValue(cmd, currentTime, 0);
      break;
    } else if (
      currentTime > cmd.endTime &&
      cmd.endTime !== Number.MAX_SAFE_INTEGER
    ) {
      // 命令已结束（非无限），使用结束值
      scale = cmd.params[1] ?? cmd.params[0] ?? 1;
    } else if (
      cmd.endTime === Number.MAX_SAFE_INTEGER &&
      currentTime >= cmd.startTime
    ) {
      // 无限命令进行中
      scale = getCommandValue(cmd, currentTime, 0);
      break;
    } else if (currentTime < cmd.startTime) {
      // 命令还没开始，使用开始值（osu! behavior: pre-read command value）
      scale = cmd.params[0] ?? 1;
      break;
    }
  }

  // Also check loops for scale values
  if (loops.length > 0) {
    const loopScale = getLoopCommandValue(loops, "S", currentTime, 0);
    if (loopScale !== null) scale = loopScale;
  }

  return scale;
}

function getVectorScale(
  commands: SbCommand[],
  loops: SbLoop[],
  currentTime: number,
): { x: number; y: number } | null {
  const vCommands = commands
    .filter((cmd) => cmd.type === "V")
    .sort((a, b) => a.startTime - b.startTime);

  for (const cmd of vCommands) {
    const isInfinite = cmd.endTime === Number.MAX_SAFE_INTEGER;
    if (
      currentTime >= cmd.endTime ||
      (isInfinite && currentTime >= cmd.startTime)
    ) {
      return {
        x: cmd.params[2] ?? cmd.params[0] ?? 1,
        y: cmd.params[3] ?? cmd.params[1] ?? 1,
      };
    } else if (currentTime >= cmd.startTime) {
      return {
        x: getCommandValue(cmd, currentTime, 0),
        y: getCommandValue(cmd, currentTime, 1),
      };
    } else if (currentTime < cmd.startTime) {
      // Pre-read: use command start value before it starts (osu! behavior)
      return {
        x: cmd.params[0] ?? 1,
        y: cmd.params[1] ?? 1,
      };
    }
  }

  // Also check loops for vector scale values
  if (loops.length > 0) {
    const loopX = getLoopCommandValue(loops, "V", currentTime, 0);
    const loopY = getLoopCommandValue(loops, "V", currentTime, 1);
    if (loopX !== null && loopY !== null) {
      return { x: loopX, y: loopY };
    }
  }

  return null;
}

function getRotation(
  commands: SbCommand[],
  loops: SbLoop[],
  currentTime: number,
): number {
  let rotation = 0;

  const rCommands = commands
    .filter((cmd) => cmd.type === "R")
    .sort((a, b) => a.startTime - b.startTime);

  for (const cmd of rCommands) {
    if (currentTime >= cmd.startTime && currentTime <= cmd.endTime) {
      rotation = getCommandValue(cmd, currentTime, 0) * (180 / Math.PI);
    } else if (
      currentTime > cmd.endTime &&
      cmd.endTime !== Number.MAX_SAFE_INTEGER
    ) {
      rotation = (cmd.params[1] ?? cmd.params[0] ?? 0) * (180 / Math.PI);
    } else if (
      cmd.endTime === Number.MAX_SAFE_INTEGER &&
      currentTime >= cmd.startTime
    ) {
      rotation = (cmd.params[0] ?? 0) * (180 / Math.PI);
    } else if (currentTime < cmd.startTime) {
      // Pre-read: use command start value before it starts (osu! behavior)
      rotation = (cmd.params[0] ?? 0) * (180 / Math.PI);
    }
  }

  // Also check loops for rotation values
  if (loops.length > 0) {
    const loopRotation = getLoopCommandValue(loops, "R", currentTime, 0);
    if (loopRotation !== null) rotation = loopRotation * (180 / Math.PI);
  }

  return rotation;
}

function getColor(
  commands: SbCommand[],
  loops: SbLoop[],
  currentTime: number,
): { r: number; g: number; b: number } | null {
  const cCommands = commands
    .filter((cmd) => cmd.type === "C")
    .sort((a, b) => a.startTime - b.startTime);

  for (const cmd of cCommands) {
    if (currentTime >= cmd.startTime && currentTime <= cmd.endTime) {
      return {
        r: getCommandValue(cmd, currentTime, 0) / 255,
        g: getCommandValue(cmd, currentTime, 1) / 255,
        b: getCommandValue(cmd, currentTime, 2) / 255,
      };
    } else if (
      currentTime > cmd.endTime &&
      cmd.endTime !== Number.MAX_SAFE_INTEGER
    ) {
      return {
        r: (cmd.params[3] ?? cmd.params[0]) / 255,
        g: (cmd.params[4] ?? cmd.params[1]) / 255,
        b: (cmd.params[5] ?? cmd.params[2]) / 255,
      };
    } else if (
      cmd.endTime === Number.MAX_SAFE_INTEGER &&
      currentTime >= cmd.startTime
    ) {
      return {
        r: getCommandValue(cmd, currentTime, 0) / 255,
        g: getCommandValue(cmd, currentTime, 1) / 255,
        b: getCommandValue(cmd, currentTime, 2) / 255,
      };
    } else if (currentTime < cmd.startTime) {
      // Pre-read: use command start value before it starts (osu! behavior)
      return {
        r: cmd.params[0] / 255,
        g: cmd.params[1] / 255,
        b: cmd.params[2] / 255,
      };
    }
  }

  // Also check loops for color values
  if (loops.length > 0) {
    const loopR = getLoopCommandValue(loops, "C", currentTime, 0);
    const loopG = getLoopCommandValue(loops, "C", currentTime, 1);
    const loopB = getLoopCommandValue(loops, "C", currentTime, 2);
    if (loopR !== null && loopG !== null && loopB !== null) {
      return { r: loopR / 255, g: loopG / 255, b: loopB / 255 };
    }
  }

  return null;
}

// Calculate hue rotation angle from RGB color
function calculateHue(r: number, g: number, b: number): number {
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
function calculateSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  if (max === 0) return 0;
  const s = (max - min) / max;
  return s * 100;
}

// Calculate brightness percentage from RGB color (average luminance)
function calculateBrightness(r: number, g: number, b: number): number {
  // Use luminance formula: 0.299R + 0.587G + 0.114B
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance * 100;
}

function isObjectVisible(
  commands: SbCommand[],
  loops: SbLoop[],
  currentTime: number,
): boolean {
  if (commands.length === 0 && loops.length === 0) return false;

  // Find the time range of all commands
  let latestEndTime = -Infinity;
  let earliestStartTime = Infinity;

  // Regular commands
  for (const cmd of commands) {
    if (cmd.startTime < earliestStartTime) earliestStartTime = cmd.startTime;
    if (cmd.endTime > latestEndTime) {
      latestEndTime = cmd.endTime;
    }
  }

  // Loop commands
  for (const loop of loops) {
    const loopMinCmdStart = Math.min(...loop.commands.map((c) => c.startTime));
    const firstExecution = loop.startTime + loopMinCmdStart;
    if (firstExecution < earliestStartTime) earliestStartTime = firstExecution;

    for (const cmd of loop.commands) {
      const lastCmdEnd =
        cmd.endTime === Number.MAX_SAFE_INTEGER
          ? Number.MAX_SAFE_INTEGER
          : cmd.endTime + loop.repeatCount * loop.loopDuration;

      if (lastCmdEnd > latestEndTime) {
        latestEndTime = lastCmdEnd;
      }
    }
  }

  // Object is not visible before first command starts
  if (earliestStartTime < 0 && currentTime < 0) return false;
  if (earliestStartTime >= 0 && currentTime < earliestStartTime) return false;

  // Object is not visible after last command ends
  if (latestEndTime !== Number.MAX_SAFE_INTEGER && currentTime > latestEndTime)
    return false;

  return true;
}

interface SbSpriteProps {
  object: SbObject;
  currentTime: number;
}

const SB_BASE_WIDTH = 640;
const SB_BASE_HEIGHT = 480;

const RENDER_WIDTH = 1920;
const RENDER_HEIGHT = 1080;

// 故事板 640x480 坐标到渲染分辨率的缩放
// osu! uses DrawScale = DrawHeight / 480 (2.25 for 1080p)
const STORYBOARD_SCALE = RENDER_HEIGHT / SB_BASE_HEIGHT; // 2.25

// SbSprite: inside scaled container, uses 640x480 coordinates
// 但 S 命令的 scale 是相对于原图，不应该被全局缩放
const SbSprite: React.FC<SbSpriteProps> = ({ object, currentTime }) => {
  const [imageSize, setImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [imgError, setImgError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // osu! behavior: silently skip sprites whose textures can't be loaded
  const handleError = useCallback(() => {
    setImgError(true);
  }, []);

  const loops = object.loops || [];

  // Position in storyboard space (640x480)
  const rawPos = getPosition(
    object.commands,
    loops,
    currentTime,
    object.x,
    object.y,
  );

  // Position in render space (1920x1080)
  // osu! storyboard container centered on screen
  // DrawScale = screenH / 480 = 2.25 for 1080p
  // Container: 640x480 storyboard space -> 1440x1080 screen space
  // Container centered: horizontal offset = (1920-1440)/2 = 240
  // Formula: screenPos = (storyboardPos - centerOffset) * scale + screenCenter
  // Which simplifies to: screenX = 240 + rawPos.x * 2.25, screenY = rawPos.y * 2.25
  const x = (RENDER_WIDTH - SB_BASE_WIDTH * STORYBOARD_SCALE) / 2 + rawPos.x * STORYBOARD_SCALE;
  const y = rawPos.y * STORYBOARD_SCALE;

  // Image dimensions in render space
  // V command (vector scale): sets absolute size in storyboard units
  // S command (scale): multiplier applied to the base size
  const vectorScale = getVectorScale(object.commands, loops, currentTime);
  const rawScale = vectorScale
    ? null  // V command takes precedence, S command is ignored
    : getScale(object.commands, loops, currentTime);

  // Use actual image dimensions when loaded
  const nativeWidth = imageSize?.width ?? 640;
  const nativeHeight = imageSize?.height ?? 480;

  // Calculate base size (includes vector scale if present)
  const vectorScaleX = vectorScale ? vectorScale.x : 1;
  const vectorScaleY = vectorScale ? vectorScale.y : 1;
  let baseWidth = nativeWidth * STORYBOARD_SCALE * vectorScaleX;
  let baseHeight = nativeHeight * STORYBOARD_SCALE * vectorScaleY;

  // Apply S command scale to the size (not just as CSS transform)
  if (rawScale !== null && rawScale !== 1) {
    baseWidth *= rawScale;
    baseHeight *= rawScale;
  }

  const calculatedOpacity = getOpacity(object.commands, loops, currentTime);
  let opacity = calculatedOpacity;
  if (opacity > 1) opacity = opacity % 1;
  const rotation = getRotation(object.commands, loops, currentTime);
  const color = getColor(object.commands, loops, currentTime);

  if (!isObjectVisible(object.commands, loops, currentTime)) return null;

  // osu! silently skips rendering when a texture can't be loaded
  if (imgError) return null;

  let src = object.path;
  if (object.type === "animation" && object.frameCount && object.frameDelay) {
    const animationStartTime = object.commands[0]?.startTime ?? 0;
    const totalDuration = object.frameCount * object.frameDelay;
    const elapsed = currentTime - animationStartTime;
    const loopType = object.loopType ?? "LoopForever";

    let frameIndex: number;
    if (loopType === "LoopOnce") {
      frameIndex =
        elapsed >= totalDuration
          ? object.frameCount - 1
          : Math.floor(elapsed / object.frameDelay) % object.frameCount;
    } else {
      frameIndex =
        Math.floor((elapsed % totalDuration) / object.frameDelay) %
        object.frameCount;
    }

    const lastDotIndex = object.path.lastIndexOf(".");
    if (lastDotIndex !== -1) {
      src =
        object.path.slice(0, lastDotIndex) +
        frameIndex +
        object.path.slice(lastDotIndex);
    }
  }

  const originFactors: Record<string, { x: number; y: number }> = {
    TopLeft: { x: 0, y: 0 },
    Centre: { x: 0.5, y: 0.5 },
    CentreLeft: { x: 0, y: 0.5 },
    TopRight: { x: 1, y: 0 },
    BottomCentre: { x: 0.5, y: 1 },
    TopCentre: { x: 0.5, y: 0 },
    CentreRight: { x: 1, y: 0.5 },
    BottomLeft: { x: 0, y: 1 },
    BottomRight: { x: 1, y: 1 },
    Custom: { x: 0, y: 0 },
  };
  const originFactor = { ...(originFactors[object.origin] || { x: 0, y: 0 }) };

  const flipH = object.flipH,
    flipV = object.flipV,
    additive = object.additive;
  const effectiveFlipH = flipH;
  const effectiveFlipV = flipV;

  if (effectiveFlipH) originFactor.x = 1 - originFactor.x;
  if (effectiveFlipV) originFactor.y = 1 - originFactor.y;

  const finalX = x - baseWidth * originFactor.x;
  const finalY = y - baseHeight * originFactor.y;

  // CSS transforms for flip and rotation only (scale is already applied to baseWidth/baseHeight)
  const transforms: string[] = [];

  if (effectiveFlipH && effectiveFlipV) transforms.push(`scale(-1, -1)`);
  else if (effectiveFlipH) transforms.push(`scale(-1, 1)`);
  else if (effectiveFlipV) transforms.push(`scale(1, -1)`);

  if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`);

  const cssOriginX = originFactor.x * 100;
  const cssOriginY = originFactor.y * 100;

  return (
    <div
      style={{
        position: "absolute",
        left: finalX,
        top: finalY,
        width: baseWidth,
        height: baseHeight,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform:
            transforms.length > 0 ? transforms.join(" ") : "translateZ(0)",
          transformOrigin: `${cssOriginX}% ${cssOriginY}%`,
          ...(additive ? { mixBlendMode: "screen" } : {}),
        }}
      >
        {color ? (
          <Img
            ref={imgRef}
            src={staticFile(src)}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                setImageSize({
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                });
              }
            }}
            onError={handleError}
            style={{
              width: "100%",
              height: "100%",
              opacity,
              filter: `brightness(${calculateBrightness(color.r, color.g, color.b)}%) saturate(${calculateSaturation(color.r, color.g, color.b) * 2}%) hue-rotate(${calculateHue(color.r, color.g, color.b)}deg)`,
            }}
          />
        ) : (
          <Img
            ref={imgRef}
            src={staticFile(src)}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                setImageSize({
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                });
              }
            }}
            onError={handleError}
            style={{
              width: "100%",
              height: "100%",
              opacity,
            }}
          />
        )}
      </div>
    </div>
  );
};

interface StoryboardLayerProps {
  storyboard?: SbObject[];
  layer?: "Background" | "Fail" | "Pass" | "Foreground" | "Overlay";
  isFailing?: boolean;
}

export const StoryboardLayer: React.FC<StoryboardLayerProps> = ({
  storyboard = [],
  layer = "Background",
  isFailing = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = (frame / fps) * 1000;

  const layerObjects = useMemo(() => {
    return storyboard.filter((obj) => {
      if (obj.layer !== layer) return false;
      if (layer === "Fail") return isFailing;
      if (layer === "Pass") return !isFailing;
      return true;
    });
  }, [storyboard, layer, isFailing]);

  // SbSprite now handles STORYBOARD_SCALE internally, so we don't need wrapper scaling
  // Position directly uses render coordinates (1920x1080)
  // Each sprite has its own z-index based on original JSON order
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: RENDER_WIDTH,
          height: RENDER_HEIGHT,
          overflow: "hidden", // Match osu!'s Masking = true for Background layer
          // No z-index to avoid creating stacking context
          // DOM order determines z-order: later sprites render on top
        }}
      >
        {layerObjects.map((obj, index) => (
          <SbSprite
            key={`${obj.id}-${index}`}
            object={obj}
            currentTime={currentTime}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const storyboard = storyboardData.objects as SbObject[];
export const storyboardDuration = storyboardData.duration;
export const storyboardSamples =
  (storyboardData as unknown as { samples?: SbSample[] }).samples || [];

// StoryboardAudioLayer: plays storyboard sound effects
interface StoryboardAudioLayerProps {
  samples?: SbSample[];
}

export const StoryboardAudioLayer: React.FC<StoryboardAudioLayerProps> = ({
  samples = [],
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = (frame / fps) * 1000;

  // Find samples that should play at current time (within 50ms tolerance)
  const activeSamples = useMemo(() => {
    return samples.filter((sample) => Math.abs(sample.time - currentTime) < 50);
  }, [samples, currentTime]);

  return (
    <>
      {activeSamples.map((sample, index) => (
        <Audio
          key={`${sample.id}-${index}`}
          src={staticFile(sample.path)}
          volume={(f) => interpolate(f, [0, 1], [0, sample.volume / 100])}
          startFrom={0}
        />
      ))}
    </>
  );
};

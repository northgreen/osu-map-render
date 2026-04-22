import { AbsoluteFill, useCurrentFrame, useVideoConfig, Img, staticFile, Audio, interpolate } from "remotion";
import { useMemo, useState, useRef } from "react";
import { SbObject, SbCommand, SbSample, SbLoop } from "./sbParser";
import storyboardData from "./storyboard.json";

// Easing interpolation functions (osu! supports 0-34)
function applyEasing(t: number, easing: number): number {
  switch (easing) {
    case 0: return t;
    case 1: return t * (2 - t);
    case 2: return t * t;
    case 3: return t * t;
    case 4: return t * (2 - t);
    case 5: return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    case 6: return t * t * t;
    case 7: return 1 - Math.pow(1 - t, 3);
    case 8: return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case 9: return t * t * t * t;
    case 10: return 1 - Math.pow(1 - t, 4);
    case 11: return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
    case 12: return t * t * t * t * t;
    case 13: return 1 - Math.pow(1 - t, 5);
    case 14: return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
    case 15: return 1 - Math.cos((t * Math.PI) / 2);
    case 16: return Math.sin((t * Math.PI) / 2);
    case 17: return -(Math.cos(Math.PI * t) - 1) / 2;
    case 18: return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
    case 19: return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    case 20:
      if (t === 0) return 0;
      if (t === 1) return 1;
      return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
    case 21: return 1 - Math.sqrt(1 - Math.pow(t, 2));
    case 22: return Math.sqrt(1 - Math.pow(t - 1, 2));
    case 23:
      if (t < 0.5) return (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2;
      return (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;
    case 24:
      if (t === 0 || t === 1) return t;
      return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3));
    case 25:
      if (t === 0 || t === 1) return t;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
    case 26:
      if (t === 0 || t === 1) return t;
      return Math.pow(2, -10 * t) * Math.sin((t * 20 - 0.75) * ((2 * Math.PI) / 3)) + 1;
    case 27:
      if (t === 0 || t === 1) return t;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 5)) + 1;
    case 28:
      if (t === 0 || t === 1) return t;
      if (t < 0.5) {
        return -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * ((2 * Math.PI) / 4.5))) / 2;
      }
      return (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * ((2 * Math.PI) / 4.5))) / 2 + 1;
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
    case 32: return 1 - bounceOut(1 - t);
    case 33: return bounceOut(t);
    case 34:
      if (t < 0.5) return (1 - bounceOut(1 - 2 * t)) / 2;
      return (1 + bounceOut(2 * t - 1)) / 2;
    default: return t;
  }
}

function bounceOut(t: number): number {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t - 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t - 2.25 / d1) * t + 0.9375;
  return n1 * (t - 2.625 / d1) * t + 0.984375;
}

// Get command value within loops - handles iteration timing
// Each iteration continues from where the previous one ended (continuous animation)
function getLoopCommandValue(loops: SbLoop[], cmdType: string, currentTime: number, paramIndex: number): number | null {
  for (const loop of loops) {
    // Check if current time is within this loop's active range
    if (currentTime < loop.startTime) continue;

    // Find minimum command start time in this loop (commands may not start at iteration 0)
    const minCmdStart = Math.min(...loop.commands.map(c => c.startTime));

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
      const cmdStartAbs = loop.startTime + cmd.startTime + iteration * loop.loopDuration;

      // If endTime is infinite, command lasts until the next command in this iteration starts
      // Or until the end of this iteration
      let cmdEndAbs: number;
      if (cmd.endTime === Number.MAX_SAFE_INTEGER) {
        // Find the next command's start time in this iteration
        const nextCmd = loop.commands.find(c => c.startTime > cmd.startTime && c.type === cmdType);
        if (nextCmd) {
          // Ends when next command starts (within this iteration)
          cmdEndAbs = loop.startTime + nextCmd.startTime + iteration * loop.loopDuration;
        } else {
          // No next command, ends at end of iteration
          cmdEndAbs = loop.startTime + cmd.startTime + (iteration + 1) * loop.loopDuration;
        }
      } else {
        cmdEndAbs = loop.startTime + cmd.endTime + iteration * loop.loopDuration;
      }

      const cmdDuration = cmdEndAbs - cmdStartAbs;

      if (currentTime >= cmdStartAbs && currentTime <= cmdEndAbs) {
        if (cmdDuration <= 0) continue;

        const relTimeInCmd = currentTime - cmdStartAbs;
        const t = relTimeInCmd / cmdDuration;

        const endIndex = cmdType === "M" || cmdType === "MX" || cmdType === "MY" || cmdType === "V"
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

function interpolateWithEasing(startTime: number, endTime: number, startValue: number, endValue: number, currentTime: number, easing: number): number {
  if (currentTime <= startTime) return startValue;
  if (currentTime >= endTime) return endValue;
  const duration = endTime - startTime;
  if (duration === 0) return endValue; // Instant change: use endValue (osu! behavior)
  const t = (currentTime - startTime) / duration;
  return startValue + (endValue - startValue) * applyEasing(t, easing);
}

function getCommandValue(cmd: SbCommand, currentTime: number, paramIndex: number): number {
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
  return interpolateWithEasing(cmd.startTime, cmd.endTime, startValue, endValue, currentTime, cmd.easing);
}

function getOpacity(commands: SbCommand[], loops: SbLoop[], currentTime: number): number {
  // osu! behavior: sprites default to opacity 1, but F commands control visibility
  // If a sprite has F commands, the value BEFORE the first F command is the first param of that command
  // This allows "fade in" effects where sprite starts invisible (F,...,0,1)

  let opacity = 1; // Default if no F commands
  let firstFStartValue: number | null = null;

  // First pass: find the first F command's start value
  for (const cmd of commands) {
    if (cmd.type === "F") {
      firstFStartValue = cmd.params[0] ?? 1;
      break;
    }
  }

  // If there's an F command, default to its start value (for "fade in" support)
  if (firstFStartValue !== null) {
    opacity = firstFStartValue;
  }

  for (const cmd of commands) {
    if (cmd.type === "F") {
      // 优先检查命令是否正在进行中
      if (currentTime >= cmd.startTime && currentTime <= cmd.endTime) {
        // 命令进行中，计算插值
        opacity = getCommandValue(cmd, currentTime, 0);
      } else if (currentTime > cmd.endTime && cmd.endTime !== Number.MAX_SAFE_INTEGER) {
        // 命令已结束（非无限），使用结束值
        opacity = cmd.params[1] ?? cmd.params[0] ?? 1;
      } else if (cmd.endTime === Number.MAX_SAFE_INTEGER && currentTime >= cmd.startTime) {
        // 无限命令进行中，使用当前值
        opacity = getCommandValue(cmd, currentTime, 0);
      }
      // currentTime < cmd.startTime: use firstFStartValue (already set as default)
    }
  }

  // Also check loops for opacity values
  if (loops.length > 0) {
    const loopOpacity = getLoopCommandValue(loops, "F", currentTime, 0);
    if (loopOpacity !== null) opacity = loopOpacity;
  }

  return opacity;
}

function getPosition(commands: SbCommand[], loops: SbLoop[], currentTime: number, defaultX: number, defaultY: number): { x: number; y: number } {
  let x = defaultX, y = defaultY;
  for (const cmd of commands) {
    if (cmd.type === "M" || cmd.type === "MX" || cmd.type === "MY") {
      // 优先检查命令是否正在进行中（currentTime 在 startTime 和 endTime 之间）
      if (currentTime >= cmd.startTime && currentTime <= cmd.endTime) {
        // 命令进行中，优先使用插值
        // M 命令: x 用 params[0,2], y 用 params[1,3]; MX 用 params[0,1]; MY 用 params[0,1]
        if (cmd.type === "M" || cmd.type === "MX") x = getCommandValue(cmd, currentTime, 0);
        if (cmd.type === "M" || cmd.type === "MY") y = getCommandValue(cmd, currentTime, 0);
      } else if (currentTime > cmd.endTime && cmd.endTime !== Number.MAX_SAFE_INTEGER) {
        // 命令已结束（非无限），使用结束坐标
        if (cmd.type === "M" || cmd.type === "MX") x = cmd.params[2] ?? cmd.params[0] ?? defaultX;
        if (cmd.type === "M" || cmd.type === "MY") y = cmd.params[3] ?? cmd.params[1] ?? defaultY;
      } else if (cmd.endTime === Number.MAX_SAFE_INTEGER && currentTime >= cmd.startTime) {
        // 无限命令进行中，使用开始坐标
        if (cmd.type === "M" || cmd.type === "MX") x = cmd.params[0] ?? defaultX;
        if (cmd.type === "M" || cmd.type === "MY") y = cmd.params[1] ?? defaultY;
      }
      // currentTime < cmd.startTime: 忽略，保持默认值或之前命令的值
      // osu! behavior: don't read command values before the command starts
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

function getScale(commands: SbCommand[], loops: SbLoop[], currentTime: number): number {
  let scale = 1;
  for (const cmd of commands) {
    if (cmd.type === "S") {
      // 优先检查命令是否正在进行中
      if (currentTime >= cmd.startTime && currentTime <= cmd.endTime) {
        scale = getCommandValue(cmd, currentTime, 0);
      } else if (currentTime > cmd.endTime && cmd.endTime !== Number.MAX_SAFE_INTEGER) {
        // 命令已结束（非无限），使用结束值
        scale = cmd.params[1] ?? cmd.params[0] ?? 1;
      } else if (cmd.endTime === Number.MAX_SAFE_INTEGER && currentTime >= cmd.startTime) {
        // 无限命令进行中：osu! behavior - use interpolation even for infinite duration
        // S command with infinite endTime still interpolates from start to end value
        scale = getCommandValue(cmd, currentTime, 0);
      }
      // currentTime < cmd.startTime: 忽略，保持之前命令的值或默认值
      // osu! behavior: don't read command values before the command starts
    }
  }

  // Also check loops for scale values
  if (loops.length > 0) {
    const loopScale = getLoopCommandValue(loops, "S", currentTime, 0);
    if (loopScale !== null) scale = loopScale;
  }

  return scale;
}

function getVectorScale(commands: SbCommand[], loops: SbLoop[], currentTime: number): { x: number; y: number } | null {
  for (const cmd of commands) {
    if (cmd.type === "V") {
      const isInfinite = cmd.endTime === Number.MAX_SAFE_INTEGER;
      if ((currentTime >= cmd.endTime) || (isInfinite && currentTime >= cmd.startTime)) {
        return { x: cmd.params[2] ?? cmd.params[0] ?? 1, y: cmd.params[3] ?? cmd.params[1] ?? 1 };
      } else if (currentTime >= cmd.startTime) {
        return { x: getCommandValue(cmd, currentTime, 0), y: getCommandValue(cmd, currentTime, 1) };
      }
      // currentTime < cmd.startTime -> 继续检查后面的命令
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

function getRotation(commands: SbCommand[], loops: SbLoop[], currentTime: number): number {
  let rotation = 0;
  for (const cmd of commands) {
    if (cmd.type === "R") {
      // 优先检查命令是否正在进行中
      if (currentTime >= cmd.startTime && currentTime <= cmd.endTime) {
        rotation = getCommandValue(cmd, currentTime, 0) * (180 / Math.PI);
      } else if (currentTime > cmd.endTime && cmd.endTime !== Number.MAX_SAFE_INTEGER) {
        // 命令已结束（非无限），使用结束值
        rotation = (cmd.params[1] ?? cmd.params[0] ?? 0) * (180 / Math.PI);
      } else if (cmd.endTime === Number.MAX_SAFE_INTEGER && currentTime >= cmd.startTime) {
        // 无限命令进行中，使用开始值
        rotation = (cmd.params[0] ?? 0) * (180 / Math.PI);
      }
      // currentTime < cmd.startTime: 忽略，保持默认值或之前命令的值
      // osu! behavior: don't read command values before the command starts
    }
  }

  // Also check loops for rotation values
  if (loops.length > 0) {
    const loopRotation = getLoopCommandValue(loops, "R", currentTime, 0);
    if (loopRotation !== null) rotation = loopRotation * (180 / Math.PI);
  }

  return rotation;
}

function getColor(commands: SbCommand[], loops: SbLoop[], currentTime: number): { r: number; g: number; b: number } | null {
  for (const cmd of commands) {
    if (cmd.type === "C") {
      // 优先检查命令是否正在进行中
      if (currentTime >= cmd.startTime && currentTime <= cmd.endTime) {
        return {
          r: getCommandValue(cmd, currentTime, 0) / 255,
          g: getCommandValue(cmd, currentTime, 1) / 255,
          b: getCommandValue(cmd, currentTime, 2) / 255
        };
      } else if (currentTime > cmd.endTime && cmd.endTime !== Number.MAX_SAFE_INTEGER) {
        // 命令已结束（非无限）
        return {
          r: (cmd.params[3] ?? cmd.params[0]) / 255,
          g: (cmd.params[4] ?? cmd.params[1]) / 255,
          b: (cmd.params[5] ?? cmd.params[2]) / 255
        };
      } else if (cmd.endTime === Number.MAX_SAFE_INTEGER && currentTime >= cmd.startTime) {
        // 无限命令进行中
        return {
          r: getCommandValue(cmd, currentTime, 0) / 255,
          g: getCommandValue(cmd, currentTime, 1) / 255,
          b: getCommandValue(cmd, currentTime, 2) / 255
        };
      }
      // currentTime < cmd.startTime -> 继续寻找之前的颜色命令
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

function isObjectVisible(commands: SbCommand[], loops: SbLoop[], currentTime: number): boolean {
  if (commands.length === 0 && loops.length === 0) return false;

  // Find the time range of all commands
  let latestEndTime = -Infinity;
  let earliestStartTime = Infinity;

  // Regular commands
  for (const cmd of commands) {
    if (cmd.startTime < earliestStartTime) earliestStartTime = cmd.startTime;
    // Include all end times (including infinite ones for visibility check)
    // An object with an infinite command is always visible after startTime
    if (cmd.endTime > latestEndTime) {
      latestEndTime = cmd.endTime;
    }
  }

  // Loop commands - calculate actual command execution time
  for (const loop of loops) {
    for (const cmd of loop.commands) {
      // First iteration command start time = loop.startTime + cmd.startTime
      const firstCmdStart = loop.startTime + cmd.startTime;
      if (firstCmdStart < earliestStartTime) earliestStartTime = firstCmdStart;

      // Last iteration command end time
      const lastCmdEnd = cmd.endTime === Number.MAX_SAFE_INTEGER
        ? Number.MAX_SAFE_INTEGER
        : cmd.endTime + loop.repeatCount * loop.loopDuration;

      if (lastCmdEnd > latestEndTime) {
        latestEndTime = lastCmdEnd;
      }
    }
  }

  // Object is not visible before first command starts
  // Allow negative start times (like -26) to be visible at time 0
  if (earliestStartTime < 0 && currentTime < 0) return false;
  if (earliestStartTime >= 0 && currentTime < earliestStartTime) return false;

  // Object is not visible after last command ends (only for positive end times)
  // If latestEndTime is still -Infinity, all commands have infinite duration
  if (latestEndTime > 0 && latestEndTime !== Number.MAX_SAFE_INTEGER && currentTime > latestEndTime) return false;

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
// osu! 内置故事板使用 640x480，游戏窗口会缩放到实际分辨率
// 但 S 命令的 scale 是相对于原图像素，不是相对于 640x480
const STORYBOARD_SCALE = RENDER_HEIGHT / SB_BASE_HEIGHT; // 2.25

// SbSprite: inside scaled container, uses 640x480 coordinates
// 但 S 命令的 scale 是相对于原图，不应该被全局缩放
const SbSprite: React.FC<SbSpriteProps> = ({ object, currentTime }) => {
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const loops = object.loops || [];

  // Position in storyboard space (640x480)
  const rawPos = getPosition(object.commands, loops, currentTime, object.x, object.y);

  // Position in render space (1920x1080)
  // osu! uses DrawScale = screenHeight / 480 = 2.25 for 1080p
  const x = (rawPos.x - SB_BASE_WIDTH / 2) * STORYBOARD_SCALE + RENDER_WIDTH / 2;
  const y = (rawPos.y - SB_BASE_HEIGHT / 2) * STORYBOARD_SCALE + RENDER_HEIGHT / 2;

  // Use actual image dimensions when loaded, otherwise use a reasonable default
  // Default to 640x480 to maintain reasonable aspect ratio before image loads
  const nativeWidth = imageSize?.width ?? 640;
  const nativeHeight = imageSize?.height ?? 480;
  const baseWidth = nativeWidth * STORYBOARD_SCALE;
  const baseHeight = nativeHeight * STORYBOARD_SCALE;

  const vectorScale = getVectorScale(object.commands, loops, currentTime);
  const rawScale = vectorScale ? null : getScale(object.commands, loops, currentTime);

  const calculatedOpacity = getOpacity(object.commands, loops, currentTime);
  let opacity = calculatedOpacity;
  if (opacity > 1) opacity = opacity % 1;
  const rotation = getRotation(object.commands, loops, currentTime);
  const color = getColor(object.commands, loops, currentTime);

  if (!isObjectVisible(object.commands, loops, currentTime)) return null;

  let src = object.path;
  if (object.type === "animation" && object.frameCount && object.frameDelay) {
    const animationStartTime = object.commands[0]?.startTime ?? 0;
    const totalDuration = object.frameCount * object.frameDelay;
    const elapsed = currentTime - animationStartTime;
    const loopType = object.loopType ?? "LoopForever";

    let frameIndex: number;
    if (loopType === "LoopOnce") {
      frameIndex = elapsed >= totalDuration ? object.frameCount - 1 : Math.floor(elapsed / object.frameDelay) % object.frameCount;
    } else {
      frameIndex = Math.floor((elapsed % totalDuration) / object.frameDelay) % object.frameCount;
    }

    const lastDotIndex = object.path.lastIndexOf('.');
    if (lastDotIndex !== -1) {
      src = object.path.slice(0, lastDotIndex) + frameIndex + object.path.slice(lastDotIndex);
    }
  }

  const originFactors: Record<string, { x: number; y: number }> = {
    TopLeft: { x: 0, y: 0 }, Centre: { x: 0.5, y: 0.5 }, CentreLeft: { x: 0, y: 0.5 },
    TopRight: { x: 1, y: 0 }, BottomCentre: { x: 0.5, y: 1 }, TopCentre: { x: 0.5, y: 0 },
    CentreRight: { x: 1, y: 0.5 }, BottomLeft: { x: 0, y: 1 }, BottomRight: { x: 1, y: 1 },
    Custom: { x: 0, y: 0 },
  };
  const originFactor = { ...(originFactors[object.origin] || { x: 0, y: 0 }) };

  const flipH = object.flipH, flipV = object.flipV, additive = object.additive;
  const effectiveFlipH = flipH;
  const effectiveFlipV = flipV;

  if (effectiveFlipH) originFactor.x = 1 - originFactor.x;
  if (effectiveFlipV) originFactor.y = 1 - originFactor.y;

  const finalX = x - baseWidth * originFactor.x;
  const finalY = y - baseHeight * originFactor.y;

  const transforms: string[] = [];
  const rawScaleX = vectorScale ? vectorScale.x : (rawScale ?? 1);
  const rawScaleY = vectorScale ? vectorScale.y : (rawScale ?? 1);
  const scaleX = rawScaleX;
  const scaleY = rawScaleY !== 1 ? rawScaleY : 1;
  if (scaleX !== 1 || scaleY !== 1) {
    transforms.push(`scale(${scaleX}, ${scaleY})`);
  }

  if (effectiveFlipH && effectiveFlipV) transforms.push(`scale(-1, -1)`);
  else if (effectiveFlipH) transforms.push(`scale(-1, 1)`);
  else if (effectiveFlipV) transforms.push(`scale(1, -1)`);

  if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`);

  const cssOriginX = originFactor.x * 100;
  const cssOriginY = originFactor.y * 100;

  return (
    <div style={{
      position: "absolute",
      left: finalX,
      top: finalY,
      width: baseWidth,
      height: baseHeight,
    }}>
      <div style={{
        position: "absolute",
        inset: 0,
        transform: transforms.length > 0 ? transforms.join(" ") : "translateZ(0)",
        transformOrigin: `${cssOriginX}% ${cssOriginY}%`,
        ...(additive ? { mixBlendMode: "screen" } : {})
      }}>
        {color ? (
          <Img
            ref={imgRef}
            src={staticFile(src)}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
              }
            }}
            style={{
              width: "100%",
              height: "100%",
              opacity,
              filter: `brightness(${calculateBrightness(color.r, color.g, color.b)}%) saturate(${calculateSaturation(color.r, color.g, color.b) * 2}%) hue-rotate(${calculateHue(color.r, color.g, color.b)}deg)`
            }}
          />
        ) : (
          <Img
            ref={imgRef}
            src={staticFile(src)}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
              }
            }}
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

export const StoryboardLayer: React.FC<StoryboardLayerProps> = ({ storyboard = [], layer = "Background", isFailing = false }) => {
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
        {layerObjects.map((obj, index) => (<SbSprite key={`${obj.id}-${index}`} object={obj} currentTime={currentTime} />))}
      </div>
    </AbsoluteFill>
  );
};

export const storyboard = storyboardData.objects as SbObject[];
export const storyboardDuration = storyboardData.duration;
export const storyboardSamples = (storyboardData as unknown as { samples?: SbSample[] }).samples || [];

// StoryboardAudioLayer: plays storyboard sound effects
interface StoryboardAudioLayerProps {
  samples?: SbSample[];
}

export const StoryboardAudioLayer: React.FC<StoryboardAudioLayerProps> = ({ samples = [] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = (frame / fps) * 1000;

  // Find samples that should play at current time (within 50ms tolerance)
  const activeSamples = useMemo(() => {
    return samples.filter(sample =>
      Math.abs(sample.time - currentTime) < 50
    );
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

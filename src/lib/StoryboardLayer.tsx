import { AbsoluteFill, useCurrentFrame, useVideoConfig, Img, staticFile, Audio } from "remotion";
import { useMemo, useState, useRef } from "react";
import { SbObject, SbCommand, SbSample } from "./sbParser";
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
    case 29:
      const c1 = 1.70158;
      return (c1 + 1) * t * t * t - c1 * t * t;
    case 30:
      const c4 = 1.70158;
      return 1 + c4 * Math.pow(t - 1, 3) + c4 * Math.pow(t - 1, 2);
    case 31:
      const c5 = 1.70158;
      const c2 = c5 * 1.525;
      if (t < 0.5) return (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2;
      return (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
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

function interpolate(startTime: number, endTime: number, startValue: number, endValue: number, currentTime: number, easing: number): number {
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
    case "MX":
    case "MY":
    case "V": // Vector Scale: x1, y1, x2, y2 (同 Move)
      endIndex = paramIndex + 2;
      break;
    case "C": // Color: r1, g1, b1, r2, g2, b2 (paramIndex 0->3, 1->4, 2->5)
      endIndex = paramIndex + 3;
      break;
    default: // F, S, R 等: start, end (paramIndex 0->1)
      endIndex = paramIndex + 1;
      break;
  }

  const endValue = cmd.params[endIndex] ?? startValue;
  return interpolate(cmd.startTime, cmd.endTime, startValue, endValue, currentTime, cmd.easing);
}

function getOpacity(commands: SbCommand[], currentTime: number): number {
  let opacity = 1;
  for (const cmd of commands) {
    if (cmd.type === "F") {
      // 命令已结束，锁定为结束值
      if (currentTime >= cmd.endTime) {
        opacity = cmd.params[1] ?? cmd.params[0] ?? 1;
      } else if (currentTime >= cmd.startTime) {
        // 命令进行中，计算插值
        opacity = getCommandValue(cmd, currentTime, 0);
      } else if (currentTime < cmd.startTime && opacity === 1) {
        // currentTime 在第一条命令之前，使用该命令的 startValue
        opacity = cmd.params[0] ?? 1;
      }
      // currentTime < cmd.startTime -> 忽略，保持上一个命令的状态
    }
  }
  return opacity;
}

function getPosition(commands: SbCommand[], currentTime: number, defaultX: number, defaultY: number): { x: number; y: number } {
  let x = defaultX, y = defaultY;
  for (const cmd of commands) {
    if (cmd.type === "M" || cmd.type === "MX" || cmd.type === "MY") {
      // 命令已结束
      if (currentTime >= cmd.endTime) {
        if (cmd.type === "M" || cmd.type === "MX") x = cmd.params[2] ?? cmd.params[0] ?? defaultX;
        if (cmd.type === "M" || cmd.type === "MY") y = cmd.params[3] ?? cmd.params[1] ?? defaultY;
      } else if (currentTime >= cmd.startTime) {
        // 命令进行中
        if (cmd.type === "M" || cmd.type === "MX") x = getCommandValue(cmd, currentTime, 0);
        if (cmd.type === "M" || cmd.type === "MY") y = getCommandValue(cmd, currentTime, 1);
      } else if (currentTime < cmd.startTime && (x === defaultX && y === defaultY)) {
        // currentTime 在第一条命令之前，使用该命令的 startValue
        if (cmd.type === "M" || cmd.type === "MX") x = cmd.params[0] ?? defaultX;
        if (cmd.type === "M" || cmd.type === "MY") y = cmd.params[1] ?? defaultY;
      }
      // currentTime < cmd.startTime -> 忽略，保持之前的值
    }
  }
  return { x, y };
}

function getScale(commands: SbCommand[], currentTime: number): number {
  let scale = 1;
  for (const cmd of commands) {
    if (cmd.type === "S") {
      if (currentTime >= cmd.endTime) {
        scale = cmd.params[1] ?? cmd.params[0] ?? 1;
      } else if (currentTime >= cmd.startTime) {
        scale = getCommandValue(cmd, currentTime, 0);
      } else if (currentTime < cmd.startTime && scale === 1) {
        // currentTime 在第一条命令之前，使用该命令的 startValue
        scale = cmd.params[0] ?? 1;
      }
      // currentTime < cmd.startTime -> 忽略，保持之前的值
    }
  }
  return scale;
}

function getVectorScale(commands: SbCommand[], currentTime: number): { x: number; y: number } | null {
  for (const cmd of commands) {
    if (cmd.type === "V") {
      if (currentTime >= cmd.endTime) {
        return { x: cmd.params[2] ?? cmd.params[0] ?? 1, y: cmd.params[3] ?? cmd.params[1] ?? 1 };
      } else if (currentTime >= cmd.startTime) {
        return { x: getCommandValue(cmd, currentTime, 0), y: getCommandValue(cmd, currentTime, 1) };
      }
      // currentTime < cmd.startTime -> 继续检查后面的命令
    }
  }
  return null;
}

function getRotation(commands: SbCommand[], currentTime: number): number {
  let rotation = 0;
  for (const cmd of commands) {
    if (cmd.type === "R") {
      if (currentTime >= cmd.endTime) {
        rotation = (cmd.params[1] ?? cmd.params[0] ?? 0) * (180 / Math.PI);
      } else if (currentTime >= cmd.startTime) {
        rotation = getCommandValue(cmd, currentTime, 0) * (180 / Math.PI);
      } else if (currentTime < cmd.startTime && rotation === 0) {
        // currentTime 在第一条命令之前，使用该命令的 startValue
        rotation = (cmd.params[0] ?? 0) * (180 / Math.PI);
      }
      // currentTime < cmd.startTime -> 忽略，保持之前的值
    }
  }
  return rotation;
}

function getColor(commands: SbCommand[], currentTime: number): { r: number; g: number; b: number } | null {
  for (const cmd of commands) {
    if (cmd.type === "C") {
      if (currentTime >= cmd.endTime) {
        return {
          r: (cmd.params[3] ?? cmd.params[0]) / 255,
          g: (cmd.params[4] ?? cmd.params[1]) / 255,
          b: (cmd.params[5] ?? cmd.params[2]) / 255
        };
      } else if (currentTime >= cmd.startTime) {
        return {
          r: getCommandValue(cmd, currentTime, 0) / 255,
          g: getCommandValue(cmd, currentTime, 1) / 255,
          b: getCommandValue(cmd, currentTime, 2) / 255
        };
      }
      // currentTime < cmd.startTime -> 继续寻找之前的颜色命令
    }
  }
  return null;
}

function isObjectVisible(commands: SbCommand[], currentTime: number): boolean {
  if (commands.length === 0) return false;

  // Find the time range of all commands
  let latestEndTime = -Infinity;
  let earliestStartTime = Infinity;
  for (const cmd of commands) {
    if (cmd.startTime < earliestStartTime) earliestStartTime = cmd.startTime;
    if (cmd.endTime > latestEndTime) latestEndTime = cmd.endTime;
  }

  // Object is not visible before first command starts
  // Allow negative start times (like -26) to be visible at time 0
  if (earliestStartTime < 0 && currentTime < 0) return false;
  if (earliestStartTime >= 0 && currentTime < earliestStartTime) return false;

  // Object is not visible after last command ends (only for positive end times)
  if (latestEndTime > 0 && currentTime > latestEndTime) return false;

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

  // Position in 640x480 space - convert to render space
  // Storyboard (320,240) should map to screen center (960,540)
  const rawPos = getPosition(object.commands, currentTime, object.x, object.y);
  const x = (rawPos.x - SB_BASE_WIDTH / 2) * STORYBOARD_SCALE + RENDER_WIDTH / 2;
  const y = (rawPos.y - SB_BASE_HEIGHT / 2) * STORYBOARD_SCALE + RENDER_HEIGHT / 2;

  // Position: x,y is the origin point in render space
  let opacity = getOpacity(object.commands, currentTime);

  const vectorScale = getVectorScale(object.commands, currentTime);
  const rawScale = vectorScale ? null : getScale(object.commands, currentTime);

  const rotation = getRotation(object.commands, currentTime);
  const color = getColor(object.commands, currentTime);

  if (opacity > 1) opacity = opacity % 1;
  if (!isObjectVisible(object.commands, currentTime)) return null;

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
  // Create a copy of origin factor to avoid mutating the original
  let originFactor = { ...(originFactors[object.origin] || { x: 0, y: 0 }) };

  const flipH = object.flipH, flipV = object.flipV, additive = object.additive;

  // 只使用 P 命令显式指定的 flip，不从负 scale 自动检测
  // 负的 scale 值已经包含在 scaleX/scaleY 中，会被 scale() 正确处理
  const effectiveFlipH = flipH;
  const effectiveFlipV = flipV;

  // Adjust origin based on flip (osu! AdjustOrigin logic)
  if (effectiveFlipH) originFactor.x = 1 - originFactor.x;
  if (effectiveFlipV) originFactor.y = 1 - originFactor.y;

  // Get image dimensions (in 640x480 space, before global scale)
  // If image hasn't loaded yet, use a reasonable default
  const baseWidth = imageSize?.width ?? 100;
  const baseHeight = imageSize?.height ?? 100;

  // Position: x,y is the origin point in render space
  // Need to offset by origin factor to get top-left corner
  const finalX = x - baseWidth * originFactor.x;
  const finalY = y - baseHeight * originFactor.y;

  // Build transform: S/V commands include STORYBOARD_SCALE
  const transforms: string[] = [];
  // Apply command scale (from S/V commands) - already includes STORYBOARD_SCALE
  // CSS transform scale is relative to element's original size, so use raw scale value
  const rawScaleX = vectorScale ? vectorScale.x : (rawScale ?? 1);
  const rawScaleY = vectorScale ? vectorScale.y : rawScale;
  if (rawScaleX !== 1 || (rawScaleY !== undefined && rawScaleY !== 1)) {
    transforms.push(`scale(${rawScaleX}, ${rawScaleY !== undefined ? rawScaleY : 1})`);
  }

  // Flip (P command H/V)
  if (effectiveFlipH && effectiveFlipV) transforms.push(`scale(-1, -1)`);
  else if (effectiveFlipH) transforms.push(`scale(-1, 1)`);
  else if (effectiveFlipV) transforms.push(`scale(1, -1)`);

  // Rotation
  if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`);

  // Convert origin factor to CSS transform-origin
  const cssOriginX = originFactor.x * 100;
  const cssOriginY = originFactor.y * 100;

  return (
    <div style={{
      position: "absolute",
      left: finalX,
      top: finalY,
      width: baseWidth,
      height: baseHeight,
      opacity,
      transform: transforms.length > 0 ? transforms.join(" ") : undefined,
      transformOrigin: `${cssOriginX}% ${cssOriginY}%`,
      ...(additive ? { mixBlendMode: "screen" } : {})
    }}>

      <Img
        ref={imgRef}
        src={staticFile(src)}
        onLoad={
          (e) => setImageSize({
            width: e.currentTarget.naturalWidth,
            height: e.currentTarget.naturalHeight
          })
        }
        style={{
          width: "100%",
          height: "100%",
          objectFit: "fill",
          ...(color ? {
            backgroundColor: `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, 
                                  ${Math.round(color.b * 255)})`, mixBlendMode: "multiply"
          } : {})
        }}
      />
    </div>
  );
};

interface StoryboardLayerProps {
  storyboard?: SbObject[];
  layer?: "Background" | "Fail" | "Pass" | "Foreground";
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
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: RENDER_WIDTH,
          height: RENDER_HEIGHT,
          overflow: "visible",
        }}
      >
        {layerObjects.map((obj) => (<SbSprite key={obj.id} object={obj} currentTime={currentTime} />))}
      </div>
    </AbsoluteFill>
  );
};

export const storyboard = storyboardData.objects as SbObject[];
export const storyboardDuration = storyboardData.duration;
export const storyboardSamples = (storyboardData as any).samples as SbSample[] || [];

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
          volume={sample.volume / 100}
          startFrom={0}
        />
      ))}
    </>
  );
};

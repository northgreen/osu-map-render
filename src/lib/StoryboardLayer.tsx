import { AbsoluteFill, useCurrentFrame, useVideoConfig, Img, staticFile } from "remotion";
import { useMemo, useState, useRef,useEffect } from "react";
import { SbObject, SbCommand, EASING_NAMES } from "./sbParser";
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
  const t = (currentTime - startTime) / (endTime - startTime);
  return startValue + (endValue - startValue) * applyEasing(t, easing);
}

function getCommandValue(cmd: SbCommand, currentTime: number, paramIndex: number): number {
  if (cmd.params.length === 0) return 0;
  if (cmd.params.length === 1) return cmd.params[0];
  const startValue = cmd.params[paramIndex];
  const endValue = cmd.params[paramIndex + 2] ?? startValue;
  return interpolate(cmd.startTime, cmd.endTime, startValue, endValue, currentTime, cmd.easing);
}

function getOpacity(commands: SbCommand[], currentTime: number): number {
  let opacity = 1;
  for (const cmd of commands) {
    if (cmd.type === "F") {
      if (currentTime < cmd.startTime) {
        opacity = cmd.params[0] ?? 1;
      } else if (currentTime <= cmd.endTime) {
        opacity = getCommandValue(cmd, currentTime, 0);
      } else if (currentTime > cmd.endTime) {
        opacity = cmd.params[1] ?? cmd.params[0] ?? 1;
      }
    }
  }
  return opacity;
}

function getPosition(commands: SbCommand[], currentTime: number, defaultX: number, defaultY: number): { x: number; y: number } {
  let x = defaultX, y = defaultY;
  for (const cmd of commands) {
    if (cmd.type === "M" || cmd.type === "MX" || cmd.type === "MY") {
      if (currentTime < cmd.startTime) {
        if (cmd.type === "M" || cmd.type === "MX") x = cmd.params[0] ?? defaultX;
        if (cmd.type === "M" || cmd.type === "MY") y = cmd.params[1] ?? defaultY;
      } else if (currentTime <= cmd.endTime) {
        if (cmd.type === "M" || cmd.type === "MX") x = getCommandValue(cmd, currentTime, 0);
        if (cmd.type === "M" || cmd.type === "MY") y = getCommandValue(cmd, currentTime, 1);
      } else if (currentTime > cmd.endTime) {
        if (cmd.type === "M" || cmd.type === "MX") x = cmd.params[2] ?? cmd.params[0] ?? defaultX;
        if (cmd.type === "M" || cmd.type === "MY") y = cmd.params[3] ?? cmd.params[1] ?? defaultY;
      }
    }
  }
  return { x, y };
}

function getScale(commands: SbCommand[], currentTime: number): number {
  let scale = 1;
  for (const cmd of commands) {
    if (cmd.type === "S") {
      if (currentTime < cmd.startTime) scale = cmd.params[0] ?? 1;
      else if (currentTime <= cmd.endTime) scale = getCommandValue(cmd, currentTime, 0);
      else if (currentTime > cmd.endTime) scale = cmd.params[1] ?? cmd.params[0] ?? 1;
    }
  }
  return scale;
}

function getVectorScale(commands: SbCommand[], currentTime: number): { x: number; y: number } | null {
  for (const cmd of commands) {
    if (cmd.type === "V") {
      if (currentTime < cmd.startTime) return { x: cmd.params[0] ?? 1, y: cmd.params[1] ?? 1 };
      if (currentTime <= cmd.endTime) return { x: getCommandValue(cmd, currentTime, 0), y: getCommandValue(cmd, currentTime, 1) };
      if (currentTime > cmd.endTime) return { x: cmd.params[2] ?? cmd.params[0] ?? 1, y: cmd.params[3] ?? cmd.params[1] ?? 1 };
    }
  }
  return null;
}

function getRotation(commands: SbCommand[], currentTime: number): number {
  let rotation = 0;
  for (const cmd of commands) {
    if (cmd.type === "R") {
      if (currentTime < cmd.startTime) rotation = (cmd.params[0] ?? 0) * (180 / Math.PI);
      else if (currentTime <= cmd.endTime) rotation = getCommandValue(cmd, currentTime, 0) * (180 / Math.PI);
      else if (currentTime > cmd.endTime) rotation = (cmd.params[1] ?? cmd.params[0] ?? 0) * (180 / Math.PI);
    }
  }
  return rotation;
}

function getColor(commands: SbCommand[], currentTime: number): { r: number; g: number; b: number } | null {
  for (const cmd of commands) {
    if (cmd.type === "C") {
      if (currentTime < cmd.startTime) return { r: (cmd.params[0] ?? 255) / 255, g: (cmd.params[1] ?? 255) / 255, b: (cmd.params[2] ?? 255) / 255 };
      if (currentTime <= cmd.endTime) return { r: getCommandValue(cmd, currentTime, 0) / 255, g: getCommandValue(cmd, currentTime, 1) / 255, b: getCommandValue(cmd, currentTime, 2) / 255 };
      if (currentTime > cmd.endTime) return { r: (cmd.params[3] ?? cmd.params[0]) / 255, g: (cmd.params[4] ?? cmd.params[1]) / 255, b: (cmd.params[5] ?? cmd.params[2]) / 255 };
    }
  }
  return null;
}

function isObjectVisible(commands: SbCommand[], currentTime: number): boolean {
  if (commands.length === 0) return false;
  let latestEndTime = 0;
  let earliestStartTime = Infinity;
  for (const cmd of commands) {
    if (cmd.startTime < earliestStartTime) earliestStartTime = cmd.startTime;
    if (cmd.endTime > latestEndTime) latestEndTime = cmd.endTime;
  }
  // Object is not visible before first command starts or after last command ends
  if (currentTime < earliestStartTime) return false;
  if (currentTime > latestEndTime) return false;
  return getOpacity(commands, currentTime) > 0;
}

interface SbSpriteProps {
  object: SbObject;
  currentTime: number;
}

const SB_BASE_WIDTH = 640;
const SB_BASE_HEIGHT = 480;
const RENDER_WIDTH = 1920;
const RENDER_HEIGHT = 1080;
// Use uniform scale to contain 640x480 in 1920x1080 (keeps entire storyboard visible)
// This matches osu! behavior for 4:3 storyboards on 16:9 screens
const SCALE = RENDER_HEIGHT / SB_BASE_HEIGHT; // 2.25
const SCALE_X = SCALE;
const SCALE_Y = SCALE;
const SCALED_WIDTH = SB_BASE_WIDTH * SCALE;  // 1440
const SCALED_HEIGHT = SB_BASE_HEIGHT * SCALE; // 1080
const OFFSET_X = (RENDER_WIDTH - SCALED_WIDTH) / 2; // 240 (black bars)
const OFFSET_Y = (RENDER_HEIGHT - SCALED_HEIGHT) / 2; // 0

const SbSprite: React.FC<SbSpriteProps> = ({ object, currentTime }) => {
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const rawPos = getPosition(object.commands, currentTime, object.x, object.y);
  const x = rawPos.x * SCALE_X + OFFSET_X;
  const y = rawPos.y * SCALE_Y + OFFSET_Y;
  let opacity = getOpacity(object.commands, currentTime);

  const vectorScale = getVectorScale(object.commands, currentTime);
  const rawScale = vectorScale ? null : getScale(object.commands, currentTime);
  const scaleX = vectorScale ? vectorScale.x : (rawScale ?? 1);
  const scaleY = vectorScale ? vectorScale.y : undefined;

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
  // Flip is independent; scale sign only matters when flip is not set
  const effectiveFlipH = flipH || (!flipH && scaleX < 0);
  const effectiveFlipV = flipV || (!flipV && scaleY !== undefined && scaleY < 0);

  // Adjust origin based on flip (osu! AdjustOrigin logic)
  if (effectiveFlipH) originFactor.x = 1 - originFactor.x;
  if (effectiveFlipV) originFactor.y = 1 - originFactor.y;

  const imgWidth = imageSize?.width ?? 640;
  const imgHeight = imageSize?.height ?? 480;
  // Width/height includes only global scale, NOT command scale
  // Command scale will be applied via transform to maintain proper flip/rotation
  const baseWidth = imgWidth * SCALE_X;
  const baseHeight = imgHeight * SCALE_Y;

  const absScaleX = Math.abs(scaleX);
  const absScaleY = scaleY !== undefined ? Math.abs(scaleY) : undefined;

  const scaledWidth = baseWidth * absScaleX;
  const scaledHeight = scaleY !== undefined ? baseHeight * Math.abs(scaleY) : scaledWidth;
  const offsetX = -originFactor.x * scaledWidth;
  const offsetY = -originFactor.y * scaledHeight;

  // Build transforms: translate to position, then apply scale, flip, rotation
  // Note: scale is applied here (not in width/height) to properly handle negative scales
  const transforms: string[] = [];
  transforms.push(`translate(${x + offsetX}px, ${y + offsetY}px)`);
  if (absScaleX !== 1 || (absScaleY !== undefined && scaleY !== 1)) {
    transforms.push(`scale(${scaleX}, ${scaleY !== undefined ? scaleY : 1})`);
  }
  // Flip is handled by the P command's flipH/flipV, not by negative scale here
  // (negative scale handling is done via effectiveFlipH/effectiveFlipV in AdjustOrigin)
  if (effectiveFlipH && effectiveFlipV) transforms.push(`scale(-1, -1)`);
  else if (effectiveFlipH) transforms.push(`scale(-1, 1)`);
  else if (effectiveFlipV) transforms.push(`scale(1, -1)`);
  if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`);

  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: scaledWidth, height: scaledHeight, opacity, transform: transforms.length > 0 ? transforms.join(" ") : undefined, transformOrigin: "0 0", ...(additive ? { mixBlendMode: "screen" } : {}) }}>
      <Img ref={imgRef} src={staticFile(src)} onLoad={(e) => setImageSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })} style={{ width: "100%", height: "100%", objectFit: "fill", ...(color ? { backgroundColor: `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`, mixBlendMode: "multiply" } : {}) }} />
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

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {layerObjects.map((obj) => (<SbSprite key={obj.id} object={obj} currentTime={currentTime} />))}
    </AbsoluteFill>
  );
};

export const storyboard = storyboardData.objects as SbObject[];
export const storyboardDuration = storyboardData.duration;

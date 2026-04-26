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
import { SbObject, SbSample } from "./sbParser";
import storyboardData from "../generated/storyboard.json";
import {
  getOpacity,
  getPosition,
  getScale,
  getVectorScale,
  getRotation,
  getColor,
  calculateHue,
  calculateSaturation,
  calculateBrightness,
  isObjectVisible,
} from "./storyboard";

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
  const x =
    (RENDER_WIDTH - SB_BASE_WIDTH * STORYBOARD_SCALE) / 2 +
    rawPos.x * STORYBOARD_SCALE;
  const y = rawPos.y * STORYBOARD_SCALE;

  // Image dimensions in render space
  // V command (vector scale): sets absolute size in storyboard units
  // S command (scale): multiplier applied to the base size
  const vectorScale = getVectorScale(object.commands, loops, currentTime);
  const rawScale = vectorScale
    ? null // V command takes precedence, S command is ignored
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

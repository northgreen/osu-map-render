import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
  Audio,
  interpolate,
  Img,
} from "remotion";
import { useMemo, useState, useCallback } from "react";
import { SbObject, SbSample, SbLoop } from "./sbParser/types";
import storyboardData from "../generated/storyboard.json";
import {
  getOpacity,
  getPosition,
  getScale,
  getVectorScale,
  getRotation,
  getColor,
  isObjectVisible,
  getFlipState,
  getNegativeScale,
} from "./storyboard";

// ─── Color Filter Helpers ───────────────────────────────────────────────────
//
// Why SVG filter? CSS `filter` does not support per-channel color matrix
// multiplication. The SVG `feColorMatrix` is the only browser-native way to
// apply osu! storyboard C (color) commands accurately.
//
// Optimization: Instead of creating a per-sprite <svg><filter> element (which
// causes DOM bloat with many sprites), we compute all unique colors at the
// layer level and render a single global <svg> with all filter definitions.
// Sprites reference filters by a stable ID derived from their color values.

/** Compute a stable filter ID from an RGB color triplet. */
function colorToFilterId(color: {
  r: number;
  g: number;
  b: number;
}): string {
  // Round to 3 decimals for stable IDs despite floating-point imprecision
  const r = Math.round(color.r * 1000);
  const g = Math.round(color.g * 1000);
  const b = Math.round(color.b * 1000);
  return `sb-color-${r}-${g}-${b}`;
}

/** Compute the effective color for an object at a given time. */
function computeObjectColor(
  object: SbObject,
  loops: SbLoop[],
  currentTime: number,
): { r: number; g: number; b: number } | null {
  // First check object's direct commands (including loop handling inside getColor)
  const directResult = getColor(object.commands, loops, currentTime);
  if (directResult) return directResult;

  // Fallback: check individual loops (for edge cases)
  if (loops.length > 0) {
    for (let i = loops.length - 1; i >= 0; i--) {
      const loopResult = getColor(loops[i].commands, [], currentTime);
      if (loopResult) return loopResult;
    }
  }

  return null;
}

interface SbSpriteProps {
  object: SbObject;
  currentTime: number;
  colorFilterId: string | null;
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
const SbSprite: React.FC<SbSpriteProps> = ({
  object,
  currentTime,
  colorFilterId,
}) => {
  const [imageSize, setImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [imgError, setImgError] = useState(false);

  // Compute animation frame index (cached per currentTime)
  const animationFrame = useMemo(() => {
    if (!(object.type === "animation" && object.frameCount && object.frameDelay)) {
      return null;
    }
    
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
    const src =
      lastDotIndex !== -1
        ? object.path.slice(0, lastDotIndex) +
          frameIndex +
          object.path.slice(lastDotIndex)
        : object.path;
    
    return { frameIndex, src };
  }, [object, currentTime]);

  // Use cached src or fallback to object.path
  const src = animationFrame?.src ?? object.path;

  // osu! behavior: silently skip sprites whose textures can't be loaded
  const handleError = useCallback(() => {
    setImgError(true);
    console.error("Img error:", src);
  }, [src]);

  const handleImgLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const img = event.currentTarget;
      if (img.naturalWidth && img.naturalHeight) {
        setImageSize({
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      }
    },
    [],
  );

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
  // Container offset (container is centered on screen)
  const containerOffsetX =
    (RENDER_WIDTH - SB_BASE_WIDTH * STORYBOARD_SCALE) / 2;
  const containerOffsetY =
    (RENDER_HEIGHT - SB_BASE_HEIGHT * STORYBOARD_SCALE) / 2;

  // Storyboard coordinates scaled by STORYBOARD_SCALE (matching osu! DrawScale)
  const x = containerOffsetX + rawPos.x * STORYBOARD_SCALE;
  const y = containerOffsetY + rawPos.y * STORYBOARD_SCALE;

  // Image dimensions in render space
  // V command (vector scale): sets absolute size in storyboard units
  // S command (scale): multiplier applied to the base size
  const vectorScale = getVectorScale(object.commands, loops, currentTime);
  const rawScale = getScale(object.commands, loops, currentTime);

  const nativeWidth = imageSize?.width ?? 640;
  const nativeHeight = imageSize?.height ?? 480;

  const vectorScaleX = vectorScale ? vectorScale.x : 1;
  const vectorScaleY = vectorScale ? vectorScale.y : 1;

  // Size = nativeSize * STORYBOARD_SCALE * VectorScale * Scale
  // STORYBOARD_SCALE converts from storyboard space to render space (matching osu! DrawScale)
  const baseWidth = nativeWidth * STORYBOARD_SCALE * vectorScaleX * rawScale;
  const baseHeight = nativeHeight * STORYBOARD_SCALE * vectorScaleY * rawScale;

  const calculatedOpacity = getOpacity(object.commands, loops, currentTime);
  let opacity = calculatedOpacity;
  if (opacity > 1) opacity = opacity % 1;
  const rotation = getRotation(object.commands, loops, currentTime);

  // Check visibility early (before expensive calculations)
  const isVisible = isObjectVisible(object.commands, loops, currentTime);

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

  const staticFlipH = object.flipH || false;
  const staticFlipV = object.flipV || false;
  const staticAdditive = object.additive || false;

  // Get dynamic flip state from command system
  const dynamicFlip = getFlipState(object.commands, loops || [], currentTime);

  // Merge: static OR dynamic
  const effectiveFlipH = staticFlipH || dynamicFlip.flipH;
  const effectiveFlipV = staticFlipV || dynamicFlip.flipV;
  const effectiveAdditive = staticAdditive || dynamicFlip.additive;

  // Detect negative scale from V commands (osu! mirrors origin on negative scale)
  const negScale = getNegativeScale(object.commands, loops || [], currentTime);

  // XOR: negative scale inverts the flip state (osu! behavior)
  // osu! StoryboardExtensions.cs: if (flipH ^ (vectorScale.X < 0))
  const effectiveFlipH_final = effectiveFlipH !== negScale.scaleXNeg;
  const effectiveFlipV_final = effectiveFlipV !== negScale.scaleYNeg;

  if (effectiveFlipH_final) originFactor.x = 1 - originFactor.x;
  if (effectiveFlipV_final) originFactor.y = 1 - originFactor.y;

  const finalX = x - baseWidth * originFactor.x;
  const finalY = y - baseHeight * originFactor.y;

  // CSS transforms for rotation and flip
  // Flip must use CSS transform because origin factor adjustment doesn't work for symmetric origins
  // (e.g., Centre: 0.5 -> 1-0.5 = 0.5, no change)
  const transforms: string[] = [];

  if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`);
  if (effectiveFlipH_final) transforms.push('scaleX(-1)');
  if (effectiveFlipV_final) transforms.push('scaleY(-1)');

  const cssOriginX = originFactor.x * 100;
  const cssOriginY = originFactor.y * 100;

  // Screen bounds check - skip rendering if sprite is completely off-screen
  const isOffScreen = useMemo(() => {
    // If image dimensions are not yet loaded, assume on-screen to avoid
    // incorrectly culling large sprites during async loading or SSR rendering.
    if (!imageSize) return false;

    const screenBounds = {
      left: -200,
      right: RENDER_WIDTH + 200,
      top: -200,
      bottom: RENDER_HEIGHT + 200,
    };

    // Calculate sprite bounds using final position and dimensions
    const spriteLeft = finalX;
    const spriteRight = finalX + baseWidth;
    const spriteTop = finalY;
    const spriteBottom = finalY + baseHeight;

    // Completely off-screen
    return (
      spriteRight < screenBounds.left ||
      spriteLeft > screenBounds.right ||
      spriteBottom < screenBounds.top ||
      spriteTop > screenBounds.bottom
    );
  }, [imageSize, finalX, finalY, baseWidth, baseHeight]);

  // Time visibility check - skip if object is outside its time range
  const isTimeVisible = useMemo(() => {
    let minTime = Infinity;
    let maxTime = -Infinity;

    for (const cmd of object.commands) {
      minTime = Math.min(minTime, cmd.startTime);
      maxTime = Math.max(maxTime, cmd.endTime ?? cmd.startTime);
    }

    for (const loop of loops) {
      const minCmdStart =
        loop.commands.length > 0
          ? Math.min(...loop.commands.map((c) => c.startTime))
          : loop.startTime;
      const effectiveStart = Math.max(loop.startTime, minCmdStart);
      minTime = Math.min(minTime, effectiveStart);
      maxTime = Math.max(maxTime, effectiveStart + (loop.repeatCount + 1) * loop.loopDuration);
    }

    // If no commands found, object is always visible in time
    if (minTime === Infinity) return true;

    // Add 500ms tolerance
    return currentTime >= minTime - 500 && currentTime <= maxTime + 500;
  }, [object.commands, loops, currentTime]);

  // Early exit: skip rendering if any visibility check fails
  if (!isVisible) return null;
  if (imgError) return null;
  if (!isTimeVisible) return null;
  if (isOffScreen) return null;

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
          ...(effectiveAdditive ? { mixBlendMode: "screen" } : {}),
        }}
      >
        <Img
          src={staticFile(src)}
          style={{
            width: "100%",
            height: "100%",
            opacity,
            objectFit: "fill",
            filter: colorFilterId ? `url(#${colorFilterId})` : "none",
          }}
          onLoad={handleImgLoad}
          onError={handleError}
        />
      </div>
    </div>
  );
};

interface StoryboardLayerProps {
  storyboard?: SbObject[];
  layer?: "Background" | "Fail" | "Pass" | "Foreground" | "Overlay";
  isFailing?: boolean;
}

// ─── GlobalColorFilters ─────────────────────────────────────────────────────
// Single SVG element containing all color filter definitions for the layer.
// Deduplicates colors so that sprites sharing the same color reuse the filter.
const GlobalColorFilters: React.FC<{
  colors: Set<string>;
  colorMap: Map<string, { r: number; g: number; b: number }>;
}> = ({ colors, colorMap }) => {
  if (colors.size === 0) return null;

  return (
    <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden="true">
      <defs>
        {Array.from(colors).map((filterId) => {
          const color = colorMap.get(filterId);
          if (!color) return null;
          return (
            <filter key={filterId} id={filterId}>
              <feColorMatrix
                type="matrix"
                values={`${color.r} 0 0 0 0 0 ${color.g} 0 0 0 0 0 ${color.b} 0 0 0 0 0 1 0`}
              />
            </filter>
          );
        })}
      </defs>
    </svg>
  );
};

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
      if (obj.type === "video") return false; // Skip video, rendered separately
      if (obj.layer !== layer) return false;
      if (layer === "Fail") return isFailing;
      if (layer === "Pass") return !isFailing;
      return true;
    });
  }, [storyboard, layer, isFailing]);

  // Compute unique colors and build a filter ID map for all visible sprites
  const { colorFilterMap, uniqueColors, colorMap } = useMemo(() => {
    const filterMap = new Map<string, string | null>();
    const colors = new Set<string>();
    const colorMap = new Map<string, { r: number; g: number; b: number }>();

    for (const obj of layerObjects) {
      const loops = obj.loops || [];
      const color = computeObjectColor(obj, loops, currentTime);
      if (color) {
        const filterId = colorToFilterId(color);
        colors.add(filterId);
        colorMap.set(filterId, color);
        filterMap.set(obj.id, filterId);
      } else {
        filterMap.set(obj.id, null);
      }
    }

    return { colorFilterMap: filterMap, uniqueColors: colors, colorMap };
  }, [layerObjects, currentTime]);

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
        {/* Single global SVG with all color filter definitions */}
        <GlobalColorFilters colors={uniqueColors} colorMap={colorMap} />
        {layerObjects.map((obj, index) => (
          <SbSprite
            key={`${obj.id}-${index}`}
            object={obj}
            currentTime={currentTime}
            colorFilterId={colorFilterMap.get(obj.id) ?? null}
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

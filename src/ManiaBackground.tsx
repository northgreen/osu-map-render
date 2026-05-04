import { AbsoluteFill, staticFile, Img, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo } from "react";
import { beatmap as importedBeatmap } from "./lib/osuParser";
import { config, STAGE_X } from "./config";
import { StoryboardLayer, storyboard, storyboardSamples } from "./lib/StoryboardLayer";
import { StoryboardAudioLayer } from "./lib/StoryboardAudioLayer";
import { replay } from "./lib/replay";

interface ManiaBackgroundProps {
  beatmap?: typeof importedBeatmap;
  isFailing?: boolean; // Controls Pass/Fail storyboard layer visibility
  storyboardEnabled?: boolean; // When true, show storyboard with black bg; when false, show bg image only
  bgDarken?: number; // 0 = no darkening, 1 = fully dark
  bgBlur?: number; // 0 = no blur, 1-20 = blur radius in pixels
  manualLayer?: "all" | "Background" | "Fail" | "Pass" | "Foreground" | "Overlay";
}

export const ManiaBackground: React.FC<ManiaBackgroundProps> = ({
  beatmap = importedBeatmap,
  isFailing = false,
  storyboardEnabled = false,
  bgDarken = 0,
  bgBlur = 0,
  manualLayer,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { backgroundImage } = beatmap;
  const bgFileName = backgroundImage ? backgroundImage.replace(/"/g, "") : null;

  // Find video object from storyboard (if any)
  const videoObject = useMemo(
    () => storyboard.find((obj) => obj.type === "video"),
    [],
  );

  // Compute isFailing from replay life data (interpolate current time to get health)
  const effectiveIsFailing = useMemo(() => {
    if (replay.lifeData && replay.lifeData.length > 0) {
      const currentTimeMs = (frame / fps) * 1000;
      const lifeData = replay.lifeData;

      // Before first entry, use first entry's health
      if (currentTimeMs <= lifeData[0].time) {
        return lifeData[0].life < 0.5;
      }

      // After last entry, use last entry's health
      if (currentTimeMs >= lifeData[lifeData.length - 1].time) {
        return lifeData[lifeData.length - 1].life < 0.5;
      }

      // Binary search for the last entry at or before currentTime
      let lo = 0;
      let hi = lifeData.length - 1;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (lifeData[mid].time <= currentTimeMs) lo = mid;
        else hi = mid;
      }

      return lifeData[lo].life < 0.5;
    }
    return isFailing;
  }, [frame, fps, isFailing]);

  return (
    <AbsoluteFill style={{
      backgroundColor: storyboardEnabled ? "#000000" : "#1a1a2e",
      "--stage-x": `${STAGE_X}px`,
      "--stage-width": `${config.stageWidth}px`,
    } as React.CSSProperties}>
      {/* Background image - only shown when storyboard is disabled */}
      {!storyboardEnabled && bgFileName && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1920,
            height: 1080,
            overflow: "hidden",
          }}
        >
          <Img
            src={staticFile(bgFileName)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.6,
              filter: bgBlur > 0 ? `blur(${bgBlur}px)` : undefined,
            }}
          />
        </div>
      )}

      {/* Background darkening overlay */}
      {!storyboardEnabled && bgFileName && bgDarken > 0 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1920,
            height: 1080,
            backgroundColor: `rgba(0, 0, 0, ${bgDarken})`,
          }}
        />
      )}

      {/* Storyboard layers - only rendered when storyboardEnabled is true */}
      {storyboardEnabled && (
        <>
          {/* Background: video (if present) or black */}
          {videoObject && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                overflow: "hidden",
              }}
            >
              <OffthreadVideo
                src={staticFile(videoObject.path)}
                muted={true}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: "translateZ(0)",
                  willChange: "transform",
                }}
              />
            </div>
          )}

          {/* All storyboard elements wrapped in blur container */}
          <div style={{ position: "absolute", inset: 0, filter: bgBlur > 0 ? `blur(${bgBlur}px)` : undefined }}>
            {/* Storyboard layer - Background */}
            <StoryboardLayer storyboard={storyboard} layer="Background" />

            {/* Storyboard layer - Fail (only when failing) */}
            <StoryboardLayer storyboard={storyboard} layer="Fail" isFailing={effectiveIsFailing} />

            {/* Storyboard layer - Pass (only when passing/not failing) */}
            <StoryboardLayer storyboard={storyboard} layer="Pass" isFailing={effectiveIsFailing} />

            {/* Storyboard layer - Foreground (always visible) */}
            <StoryboardLayer storyboard={storyboard} layer="Foreground" />

            {/* Storyboard layer - Overlay (topmost within blur) */}
            <StoryboardLayer storyboard={storyboard} layer="Overlay" />
          </div>

          {/* Darkening overlay - on top of all storyboard elements, before stage */}
          {bgDarken > 0 && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: `rgba(0, 0, 0, ${bgDarken})`,
              }}
            />
          )}

          {/* Storyboard audio layer - rendered last (non-visual, doesn't overlap with elements) */}
          <StoryboardAudioLayer
            samples={storyboardSamples}
            isFailing={effectiveIsFailing}
            manualLayer={manualLayer}
          />
        </>
      )}
    </AbsoluteFill>
  );
};

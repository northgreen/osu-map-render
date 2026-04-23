import { AbsoluteFill, staticFile, Img } from "remotion";
import { beatmap as importedBeatmap } from "./lib/osuParser";
import { config, STAGE_X } from "./config";
import { StoryboardLayer, storyboard } from "./lib/StoryboardLayer";

interface ManiaBackgroundProps {
  beatmap?: typeof importedBeatmap;
  isFailing?: boolean; // Controls Pass/Fail storyboard layer visibility
  storyboardEnabled?: boolean; // When true, show storyboard with black bg; when false, show bg image only
}

export const ManiaBackground: React.FC<ManiaBackgroundProps> = ({
  beatmap = importedBeatmap,
  isFailing = false,
  storyboardEnabled = false,
}) => {
  const { backgroundImage } = beatmap;
  const bgFileName = backgroundImage ? backgroundImage.replace(/"/g, "") : null;

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
            }}
          />
        </div>
      )}

      {/* Storyboard layers - only rendered when storyboardEnabled is true */}
      {storyboardEnabled && (
        <>
          {/* Storyboard layer - Background */}
          <StoryboardLayer storyboard={storyboard} layer="Background" />

          {/* Storyboard layer - Fail (only when failing) */}
          <StoryboardLayer storyboard={storyboard} layer="Fail" isFailing={isFailing} />

          {/* Storyboard layer - Pass (only when passing/not failing) */}
          <StoryboardLayer storyboard={storyboard} layer="Pass" isFailing={isFailing} />

          {/* Storyboard layer - Foreground (always visible) */}
          <StoryboardLayer storyboard={storyboard} layer="Foreground" />

          {/* Storyboard layer - Overlay (topmost, always visible) */}
          <StoryboardLayer storyboard={storyboard} layer="Overlay" />
        </>
      )}
    </AbsoluteFill>
  );
};

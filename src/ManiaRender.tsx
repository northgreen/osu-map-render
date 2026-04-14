import { AbsoluteFill, Audio, staticFile } from "remotion";
import { ManiaBackground } from "./ManiaBackground";
import { ManiaStageLayer } from "./ManiaStageLayer";
import { ManiaOverlay } from "./ManiaOverlay";
import { beatmap as importedBeatmap, getBeatmapDuration } from "./lib/osuParser";
import "./lib/replay"; // Force import replay.json

interface ManiaRenderProps {
  scrollSpeed?: number;
  timeOffset?: number;
  beatOffset?: number;
}

export const ManiaRender: React.FC<ManiaRenderProps> = ({
  scrollSpeed = 20,
  timeOffset = 0,
  beatOffset = 900,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#1a1a2e" }}>
      {/* Audio - shared across all layers */}
      <Audio src={staticFile("audio.mp3")} />

      {/* Layer 1: Background */}
      <ManiaBackground />

      {/* Layer 2: Stage (notes, judgment line, key presses, hit effects) */}
      <ManiaStageLayer
        beatmap={importedBeatmap}
        scrollSpeed={scrollSpeed}
        beatOffset={beatOffset + timeOffset}
      />

      {/* Layer 3: Overlay (info display: metadata, score, PP) */}
      <ManiaOverlay beatmap={importedBeatmap} />
    </AbsoluteFill>
  );
};

// Helper to get duration
export function getManiaRenderDuration(beatOffset: number = 900): number {
  const baseDuration = getBeatmapDuration(importedBeatmap);
  return baseDuration + beatOffset;
}
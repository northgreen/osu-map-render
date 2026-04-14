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
  judgmentMode?: "v1" | "v2";
  judgmentOffset?: number;
}

// Create a wrapper component with defaultProps
const ManiaRenderComponent: React.FC<ManiaRenderProps> = ({
  scrollSpeed = 20,
  timeOffset = 0,
  beatOffset = 900,
  judgmentMode = "v1",
  judgmentOffset = 0,
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
      <ManiaOverlay beatmap={importedBeatmap} judgmentMode={judgmentMode} judgmentOffset={judgmentOffset} />
    </AbsoluteFill>
  );
};

// Add defaultProps for Remotion Studio
ManiaRenderComponent.defaultProps = {
  scrollSpeed: 20,
  timeOffset: 0,
  beatOffset: 900,
  judgmentMode: "v2",
  judgmentOffset: 0,
};

export { ManiaRenderComponent as ManiaRender };

// Helper to get duration
export function getManiaRenderDuration(beatOffset: number = 900): number {
  const baseDuration = getBeatmapDuration(importedBeatmap);
  return baseDuration + beatOffset;
}
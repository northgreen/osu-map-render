import { AbsoluteFill, Audio, staticFile } from "remotion";
import { ManiaBackground } from "./ManiaBackground";
import { ManiaStageLayer } from "./ManiaStageLayer";
import { ManiaOverlay } from "./ManiaOverlay";
import { beatmap as importedBeatmap, getBeatmapDuration } from "./lib/osuParser";
import { ManiaRenderProps } from "./Root";
import "./lib/replay"; // Force import replay.json

// Create a wrapper component with defaultProps
const ManiaRenderComponent: React.FC<ManiaRenderProps> = (props) => {
  const {
    time = { beatOffset: 900, timeOffset: 0 },
    scroll = { scrollSpeed: 20 },
    judgment = { mode: "v2", offset: 0, showZones: false },
    layout = { stageOffset: 0, judgmentLineY: 900 }
  } = props;

  const { beatOffset, timeOffset } = time;
  const { scrollSpeed } = scroll;
  const { mode, offset, showZones } = judgment;
  const { stageOffset, judgmentLineY } = layout;

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
        beatOffset={(beatOffset || 900) + (timeOffset || 0)}
        showJudgmentZones={showZones}
        stageOffset={stageOffset}
        judgmentLineY={judgmentLineY}
      />

      {/* Layer 3: Overlay (info display: metadata, score, PP) */}
      <ManiaOverlay
        beatmap={importedBeatmap}
        judgmentMode={mode}
        judgmentOffset={offset}
        stageOffset={stageOffset}
        judgmentLineY={judgmentLineY}
      />
    </AbsoluteFill>
  );
};

// Add defaultProps for Remotion Studio
ManiaRenderComponent.defaultProps = {
  time: { beatOffset: 900, timeOffset: 0 },
  scroll: { scrollSpeed: 20 },
  judgment: { mode: "v2", offset: 0, showZones: false },
  layout: { stageOffset: 0, judgmentLineY: 900 },
};

export { ManiaRenderComponent as ManiaRender };

// Helper to get duration
export function getManiaRenderDuration(beatOffset: number = 900): number {
  const baseDuration = getBeatmapDuration(importedBeatmap);
  return baseDuration + beatOffset;
}

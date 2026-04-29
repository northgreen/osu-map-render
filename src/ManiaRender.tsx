import { AbsoluteFill, Audio, staticFile } from "remotion";
import { ManiaBackground } from "./ManiaBackground";
import { ManiaStageLayer } from "./ManiaStageLayer";
import { ManiaOverlay } from "./ManiaOverlay";
import {
  beatmap as importedBeatmap,
  getBeatmapDuration,
} from "./lib/osuParser";
import { ManiaRenderProps, maniaRenderContentsSchema } from "./Root";
import {
  setJudgmentMode,
  setJudgmentOffset,
  setCustomWindows,
} from "./lib/judgment";
import { config, STAGE_X } from "./config";
import "./lib/replay"; // Force import replay.json

// Create a wrapper component with default props handled via destructuring
const ManiaRenderComponent: React.FC<ManiaRenderProps> = (props) => {
  const {
    time = { beatOffset: 900, timeOffset: 0 },
    scroll = { scrollSpeed: 20 },
    judgment = { mode: "v2", offset: 0, showZones: false },
    layout = { stageOffset: 0, judgmentLineY: 900 },
    contents = { trackHeight: true, replayCursor: true, sessionLine: true },
  } = props;

  const { beatOffset, timeOffset } = time;
  const { scrollSpeed } = scroll;
  const { mode, offset, showZones, customWindows } = judgment;
  const { stageOffset, judgmentLineY } = layout;

  // Merge with defaults from schema
  const contentsWithDefaults = maniaRenderContentsSchema.parse(contents);
  const {
    trackHeight,
    replayCursor,
    sessionLine,
    columnHighlights,
    storyboardEnabled,
    bgDarken,
  } = contentsWithDefaults;

  // Set judgment mode and custom windows
  setJudgmentMode(mode);
  setJudgmentOffset(offset);
  if (customWindows) {
    setCustomWindows(customWindows);
  }

  return (
    <AbsoluteFill
      style={
        {
          backgroundColor: "#1a1a2e",
          "--stage-x": `${STAGE_X}px`,
          "--stage-width": `${config.stageWidth}px`,
        } as React.CSSProperties
      }
    >
      {/* Audio - shared across all layers */}
      <Audio src={staticFile("audio.mp3")} />

      {/* Layer 1: Background (handles bg image or black bg + storyboard based on storyboardEnabled) */}
      <ManiaBackground storyboardEnabled={storyboardEnabled} bgDarken={bgDarken} />

      {/* Layer 2: Stage (notes, judgment line, key presses, hit effects) */}
      <ManiaStageLayer
        beatmap={importedBeatmap}
        scrollSpeed={scrollSpeed}
        beatOffset={(beatOffset || 900) + (timeOffset || 0)}
        showJudgmentZones={showZones}
        stageOffset={stageOffset}
        judgmentLineY={judgmentLineY}
        showReplayCursor={replayCursor}
        showJudgmentLine={trackHeight}
        showBeatLines={sessionLine}
        showColumnHighlights={columnHighlights}
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

export { ManiaRenderComponent as ManiaRender };

// Helper to get duration
export function getManiaRenderDuration(beatOffset: number = 900): number {
  const baseDuration = getBeatmapDuration(importedBeatmap);
  return baseDuration + beatOffset;
}

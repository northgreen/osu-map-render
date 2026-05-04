import "./index.css";
import "./styles.css";
import { Composition, AbsoluteFill, Audio, staticFile } from "remotion";
import { z } from "zod";
import { ManiaRender } from "./ManiaRender";
import { ManiaBackground } from "./ManiaBackground";
import { ManiaStageLayer } from "./ManiaStageLayer";
import { ManiaOverlay } from "./ManiaOverlay";
import { ReplayCursorLayer } from "./ReplayCursorLayer";
import { beatmap, getBeatmapDuration } from "./lib/osuParser";
import {
  setJudgmentMode,
  setJudgmentOffset,
  setCustomWindows,
} from "./lib/judgment";
import { setKeyCount } from "./config";
import { maniaRenderSchema, maniaRenderContentsSchema, ManiaRenderProps } from "./schema";
// Set key count from beatmap on module load
const keyCountFromBeatmap = beatmap?.difficulty?.circleSize || 4;
setKeyCount(keyCountFromBeatmap);



// Get 3 beats offset from first timing point
function getBeatOffset(): number {
  const firstTp = beatmap.timingPoints?.[0];
  if (!firstTp?.beatLength || firstTp.beatLength <= 0) {
    return 3 * 500;
  }
  return 3 * firstTp.beatLength;
}

// Each <Composition> is an entry in the sidebar!

// ManiaStageOnly component with default props handled via destructuring
const ManiaStageOnlyComponent: React.FC<ManiaRenderProps> = (props) => {
  const {
    time = { beatOffset: 900, timeOffset: 0 },
    scroll = { scrollSpeed: 20 },
    judgment = { mode: "v2", offset: 0, showZones: false },
    layout = { stageOffset: 0, judgmentLineY: 900, judgmentTextY: 750 },
    contents = {},
  } = props;

  const { beatOffset, timeOffset } = time;
  const scrollSpeed = scroll.scrollSpeed;
  const { mode, offset, showZones, customWindows } = judgment;
  const stageOffset = layout.stageOffset;
  const judgmentLineY = layout.judgmentLineY;

  // Set judgment mode and custom windows
  setJudgmentMode(mode);
  setJudgmentOffset(offset);
  if (customWindows) {
    setCustomWindows(customWindows);
  }

  // Parse contents with defaults
  const contentsWithDefaults = maniaRenderContentsSchema.parse(contents);
  const { trackHeight, replayCursor, sessionLine, columnHighlights, stageBgOpacity, hitsounds } =
    contentsWithDefaults;

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      <Audio src={staticFile(beatmap.audioFile || "audio.mp3")} />
      <ManiaStageLayer
        beatmap={beatmap}
        scrollSpeed={scrollSpeed}
        beatOffset={(beatOffset || 900) + (timeOffset || 0)}
        showJudgmentZones={showZones}
        stageOffset={stageOffset}
        judgmentLineY={judgmentLineY}
        showReplayCursor={replayCursor}
        showJudgmentLine={trackHeight}
        showBeatLines={sessionLine}
        showColumnHighlights={columnHighlights}
        stageBgOpacity={stageBgOpacity}
        hitsounds={hitsounds}
      />
    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => {
  const beatOffset = getBeatOffset();
  const baseDuration = getBeatmapDuration(beatmap);
  const totalDuration = baseDuration + beatOffset;
  const fps = 60;
  const durationInFrames = Math.ceil((totalDuration / 1000) * fps);

  return (
    <>
      {/* Combined render - all layers */}
      <Composition
        id="ManiaRender"
        component={ManiaRender}
        durationInFrames={durationInFrames}
        fps={fps}
        width={1920}
        height={1080}
        schema={maniaRenderSchema}
        defaultProps={{
          time: { beatOffset: 0, timeOffset: 0 },
          scroll: { scrollSpeed: 27 },
          judgment: { mode: "v2" as const, offset: 0, showZones: false },
          layout: { stageOffset: 637, judgmentLineY: 946, judgmentTextY: 850 },
          contents: {
            trackHeight: true,
            columnHighlights: true,
            replayCursor: true,
            sessionLine: true,
            storyboardEnabled: true,
            bgDarken: 0.4,
            bgBlur: 7,
            stageBgOpacity: 0.8,
            hitsounds: { enabled: true, trigger: "auto" as const, volume: 1 },
            hitOffsetIndicator: {
              enabled: true,
              x: 0,
              y: 1040,
              width: 600,
              height: 30,
              timeWindow: 3000,
              maxHits: 0,
              maxOffset: 0,
              showCenterLine: true,
              showLabels: true,
            },
          },
        }}
      />

      {/* Background layer (bg + audio) */}
      <Composition
        id="ManiaBackground"
        component={({
          contents,
        }: {
          contents?: z.infer<typeof maniaRenderContentsSchema>;
        }) => {
          const parsed = maniaRenderContentsSchema.parse(contents ?? {});
          return (
            <AbsoluteFill>
              <Audio src={staticFile(beatmap.audioFile || "audio.mp3")} />
              <ManiaBackground storyboardEnabled={parsed.storyboardEnabled} bgDarken={parsed.bgDarken} />
            </AbsoluteFill>
          );
        }}
        durationInFrames={durationInFrames}
        fps={fps}
        width={1920}
        height={1080}
        schema={maniaRenderSchema}
        defaultProps={{
          time: { beatOffset: 900, timeOffset: 0 },
          scroll: { scrollSpeed: 20 },
          judgment: { mode: "v2" as const, offset: 0, showZones: false },
          layout: { stageOffset: 0, judgmentLineY: 900 },
          contents: {
            storyboardEnabled: true,
            hitsounds: {
              enabled: true,
              trigger: "auto" as const,
              volume: 1.0,
            },
            hitOffsetIndicator: {
              enabled: false,
              x: 0,
              y: 540,
              width: 600,
              height: 30,
              timeWindow: 3000,
              maxHits: 0,
              maxOffset: 0,
              showCenterLine: true,
              showLabels: false,
            },
          },
        }}
      />

      {/* Stage layer (beat lines, notes, key presses, hit effects + audio) */}
      <Composition
        id="ManiaStageOnly"
        component={ManiaStageOnlyComponent}
        durationInFrames={durationInFrames}
        fps={fps}
        width={1920}
        height={1080}
        schema={maniaRenderSchema}
        defaultProps={{
          time: { beatOffset: 900, timeOffset: 0 },
          scroll: { scrollSpeed: 20 },
          judgment: { mode: "v2" as const, offset: 0, showZones: false },
          layout: { stageOffset: 507, judgmentLineY: 1000, judgmentTextY: 850 },
          contents: {
            trackHeight: true,
            columnHighlights: false,
            replayCursor: true,
            sessionLine: true,
            storyboardEnabled: false,
            bgDarken: 0.0,
            bgBlur: 0.0,
            stageBgOpacity: 1.0,
            hitsounds: {
              enabled: true,
              trigger: "auto" as const,
              volume: 1.0,
            },
            hitOffsetIndicator: {
              enabled: false,
              x: 0,
              y: 540,
              width: 600,
              height: 30,
              timeWindow: 3000,
              maxHits: 0,
              maxOffset: 0,
              showCenterLine: true,
              showLabels: false,
            },
          },
        }}
      />

      {/* Overlay only (info display: metadata, score, PP) */}
      <Composition
        id="ManiaOverlayOnly"
        component={() => (
          <AbsoluteFill style={{ backgroundColor: "transparent" }}>
            <Audio src={staticFile(beatmap.audioFile || "audio.mp3")} />
            <ManiaOverlay beatmap={beatmap} />
          </AbsoluteFill>
        )}
        durationInFrames={durationInFrames}
        fps={fps}
        width={1920}
        height={1080}
      />

      {/* Replay cursor only (falling key press bars) */}
      <Composition
        id="ManiaReplayCursorOnly"
        component={(props: ManiaRenderProps) => {
          const scrollSpeed = props.scroll?.scrollSpeed ?? 20;
          const stageOffset = props.layout?.stageOffset ?? 0;
          const judgmentLineY = props.layout?.judgmentLineY ?? 900;
          return (
            <AbsoluteFill style={{ backgroundColor: "transparent" }}>
              <Audio src={staticFile(beatmap.audioFile || "audio.mp3")} />
              <ReplayCursorLayer
                scrollSpeed={scrollSpeed}
                stageOffset={stageOffset}
                judgmentLineY={judgmentLineY}
              />
            </AbsoluteFill>
          );
        }}
        durationInFrames={durationInFrames}
        fps={fps}
        width={1920}
        height={1080}
        schema={maniaRenderSchema}
        defaultProps={{
          time: { beatOffset: 900, timeOffset: 0 },
          scroll: { scrollSpeed: 30 },
          judgment: { mode: "v2" as const, offset: 0, showZones: false },
          layout: { stageOffset: 499, judgmentLineY: 1000, judgmentTextY: 850 },
          contents: {
            trackHeight: true,
            columnHighlights: true,
            replayCursor: true,
            sessionLine: true,
            storyboardEnabled: false,
            bgDarken: 0.0,
            bgBlur: 0.0,
            stageBgOpacity: 1.0,
            hitsounds: {
              enabled: true,
              trigger: "auto" as const,
              volume: 1.0,
            },
            hitOffsetIndicator: {
              enabled: false,
              x: 0,
              y: 540,
              width: 600,
              height: 30,
              timeWindow: 3000,
              maxHits: 0,
              maxOffset: 0,
              showCenterLine: true,
              showLabels: false,
            },
          },
        }}
      />
    </>
  );
};

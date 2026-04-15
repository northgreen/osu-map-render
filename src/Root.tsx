import "./index.css";
import "./styles.css";
import { Composition, AbsoluteFill, Audio, staticFile } from "remotion";
import { z } from "zod";
import { ManiaRender, getManiaRenderDuration } from "./ManiaRender";
import { ManiaBackground } from "./ManiaBackground";
import { ManiaStageLayer } from "./ManiaStageLayer";
import { ManiaOverlay } from "./ManiaOverlay";
import { ReplayCursorLayer } from "./ReplayCursorLayer";
import { beatmap, getBeatmapDuration } from "./lib/osuParser";
import "./lib/replay"; // Force import replay.json

// ============================================
// Nested Props Schema
// ============================================

export const maniaRenderSchema = z.object({
  time: z.object({
    beatOffset: z.number().min(0),
    timeOffset: z.number(),
  }),
  scroll: z.object({
    scrollSpeed: z.number().min(5).max(50),
  }),
  judgment: z.object({
    mode: z.enum(["v1", "v2"]).default("v1"),
    offset: z.number().default(0),
    showZones: z.boolean().default(false),
  }),
  layout: z.object({
    stageOffset: z.number().default(0),
    judgmentLineY: z.number().min(100).max(1000).default(900),
  }),
});

export type ManiaRenderProps = z.infer<typeof maniaRenderSchema>;

// Get 3 beats offset from first timing point
function getBeatOffset(): number {
  const firstTp = beatmap.timingPoints?.[0];
  if (!firstTp?.beatLength || firstTp.beatLength <= 0) {
    return 3 * 500;
  }
  return 3 * firstTp.beatLength;
}

// Each <Composition> is an entry in the sidebar!

// ManiaStageOnly component with defaultProps for proper Remotion integration
const ManiaStageOnlyComponent: React.FC<ManiaRenderProps> = (props) => {
  const {
    scroll = { scrollSpeed: 20 },
    judgment = { showZones: false },
    layout = { stageOffset: 0, judgmentLineY: 900 }
  } = props;

  const scrollSpeed = scroll.scrollSpeed;
  const showZones = judgment.showZones;
  const stageOffset = layout.stageOffset;
  const judgmentLineY = layout.judgmentLineY;

  // Debug: log received props
  console.log("ManiaStageOnly received props:", JSON.stringify(props));

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      <Audio src={staticFile("audio.mp3")} />
      <ManiaStageLayer
        beatmap={beatmap}
        scrollSpeed={scrollSpeed}
        beatOffset={900}
        showJudgmentZones={showZones}
        stageOffset={stageOffset}
        judgmentLineY={judgmentLineY}
      />
    </AbsoluteFill>
  );
};

ManiaStageOnlyComponent.defaultProps = {
  time: { beatOffset: 900, timeOffset: 0 },
  scroll: { scrollSpeed: 20 },
  judgment: { mode: "v2", offset: 0, showZones: false },
  layout: { stageOffset: 0, judgmentLineY: 900 },
};

export const RemotionRoot: React.FC = () => {
  const beatOffset = getBeatOffset();
  const baseDuration = getBeatmapDuration(beatmap);
  const totalDuration = baseDuration + beatOffset;
  const fps = 60;
  const durationInFrames = Math.ceil(totalDuration / 1000 * fps);

  const defaultProps: ManiaRenderProps = {
    time: { beatOffset, timeOffset: 0 },
    scroll: { scrollSpeed: 20 },
    judgment: { mode: "v2", offset: 0, showZones: false },
    layout: { stageOffset: 0, judgmentLineY: 900 },
  };

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
          time: { beatOffset: 900, timeOffset: 0 },
          scroll: { scrollSpeed: 20 },
          judgment: { mode: "v2" as const, offset: 0, showZones: false },
          layout: { stageOffset: 642, judgmentLineY: 1000 },
        }}
      />

      {/* Background layer (bg + audio) */}
      <Composition
        id="ManiaBackground"
        component={() => (
          <AbsoluteFill>
            <Audio src={staticFile("audio.mp3")} />
            <ManiaBackground />
          </AbsoluteFill>
        )}
        durationInFrames={durationInFrames}
        fps={fps}
        width={1920}
        height={1080}
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
          layout: { stageOffset: 507, judgmentLineY: 1000 },
        }}
      />

      {/* Overlay only (info display: metadata, score, PP) */}
      <Composition
        id="ManiaOverlayOnly"
        component={() => (
          <AbsoluteFill style={{ backgroundColor: "transparent" }}>
            <Audio src={staticFile("audio.mp3")} />
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
              <Audio src={staticFile("audio.mp3")} />
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
          layout: { stageOffset: 499, judgmentLineY: 1000 },
        }}
      />
    </>
  );
};

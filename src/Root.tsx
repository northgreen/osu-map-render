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

// Zod schema for props
export const maniaRenderSchema = z.object({
  scrollSpeed: z.number().min(5).max(50),
  timeOffset: z.number(),
  beatOffset: z.number().min(0),
  judgmentMode: z.enum(["v1", "v2"]).default("v1"),
  judgmentOffset: z.number().default(0),
  showJudgmentZones: z.boolean().default(false),
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

export const RemotionRoot: React.FC = () => {
  const beatOffset = getBeatOffset();
  const baseDuration = getBeatmapDuration(beatmap);
  const totalDuration = baseDuration + beatOffset;
  const fps = 60;
  const durationInFrames = Math.ceil(totalDuration / 1000 * fps);

  const defaultProps: ManiaRenderProps = {
    scrollSpeed: 20,
    timeOffset: 0,
    beatOffset,
    judgmentMode: "v2",
    judgmentOffset: 0,
    showJudgmentZones: true,
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
        defaultProps={defaultProps}
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
        component={({ scrollSpeed = 20, showJudgmentZones = false }: ManiaRenderProps) => (
          <AbsoluteFill style={{ backgroundColor: "transparent" }}>
            <Audio src={staticFile("audio.mp3")} />
            <ManiaStageLayer
              beatmap={beatmap}
              scrollSpeed={scrollSpeed}
              beatOffset={beatOffset}
              showJudgmentZones={showJudgmentZones}
            />
          </AbsoluteFill>
        )}
        durationInFrames={durationInFrames}
        fps={fps}
        width={1920}
        height={1080}
        schema={maniaRenderSchema}
        defaultProps={defaultProps}
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
        defaultProps={{
          beatmap,
        }}
      />

      {/* Replay cursor only (falling key press bars) */}
      <Composition
        id="ManiaReplayCursorOnly"
        component={({ scrollSpeed = 20 }: ManiaRenderProps) => (
          <AbsoluteFill style={{ backgroundColor: "transparent" }}>
            <Audio src={staticFile("audio.mp3")} />
            <ReplayCursorLayer scrollSpeed={scrollSpeed} />
          </AbsoluteFill>
        )}
        durationInFrames={durationInFrames}
        fps={fps}
        width={1920}
        height={1080}
        schema={maniaRenderSchema}
        defaultProps={defaultProps}
      />
    </>
  );
};

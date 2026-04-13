import "./index.css";
import { Composition } from "remotion";
import { ManiaStage } from "./ManiaStage";
import { beatmap, getBeatmapDuration } from "./lib/osuParser";

// Each <Composition> is an entry in the sidebar!

export const RemotionRoot: React.FC = () => {
  const duration = getBeatmapDuration(beatmap);
  const fps = 60;

  return (
    <>
      {/* osu!mania beatmap render */}
      <Composition
        id="ManiaRender"
        component={ManiaStage}
        durationInFrames={Math.ceil(duration / 1000 * fps)}
        fps={fps}
        width={1920}
        height={1080}
        defaultProps={{
          beatmap,
        }}
      />
    </>
  );
};

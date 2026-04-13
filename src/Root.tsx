import "./index.css";
import { Composition } from "remotion";
import { ManiaStage } from "./ManiaStage";
import { beatmap, getBeatmapDuration } from "./lib/osuParser";
import "./lib/replay"; // Force import replay.json

// Input props for ManiaRender
export type ManiaRenderProps = {
  scrollSpeed: number;
  timeOffset: number;
};

export const defaultProps: ManiaRenderProps = {
  scrollSpeed: 20,
  timeOffset: 0,
};

// Each <Composition> is an entry in the sidebar!

export const RemotionRoot: React.FC = () => {
  const duration = getBeatmapDuration(beatmap);
  const fps = 60;

  // Merge beatmap with props
  const props = { beatmap, ...defaultProps };

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
        defaultProps={props}
        inputProps={defaultProps}
      />
    </>
  );
};

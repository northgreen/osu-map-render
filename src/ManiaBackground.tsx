import { AbsoluteFill, staticFile, Img } from "remotion";
import { beatmap as importedBeatmap } from "./lib/osuParser";

interface ManiaBackgroundProps {
  beatmap?: typeof importedBeatmap;
}

export const ManiaBackground: React.FC<ManiaBackgroundProps> = ({ beatmap = importedBeatmap }) => {
  const { backgroundImage } = beatmap;
  const bgFileName = backgroundImage ? backgroundImage.replace(/"/g, "") : null;

  return (
    <AbsoluteFill style={{ backgroundColor: "#1a1a2e" }}>
      {/* Background image */}
      {bgFileName && (
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

    </AbsoluteFill>
  );
};

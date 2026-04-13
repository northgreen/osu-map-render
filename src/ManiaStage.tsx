import { AbsoluteFill, Audio, staticFile } from "remotion";
import { ParsedBeatmap } from "./lib/osuParser";
import { ManiaNote } from "./ManiaNote";

interface ManiaStageProps {
  beatmap?: ParsedBeatmap;
}

const COLUMN_POSITIONS = [64, 192, 320, 448];
const COLUMN_WIDTH = 128;
const STAGE_WIDTH = 512;
const STAGE_X = (1920 - STAGE_WIDTH) / 2;
const JUDGMENT_LINE_Y = 900;

export const ManiaStage: React.FC<ManiaStageProps> = ({ beatmap }) => {
  if (!beatmap) {
    return (
      <AbsoluteFill style={{ backgroundColor: "#1a1a2e", justifyContent: "center", alignItems: "center" }}>
        <div style={{ color: "white", fontSize: 24 }}>No beatmap loaded</div>
      </AbsoluteFill>
    );
  }

  const { metadata, difficulty, hitObjects } = beatmap;

  return (
    <AbsoluteFill style={{ backgroundColor: "#1a1a2e" }}>
      {/* Audio */}
      <Audio src={staticFile("audio.mp3")} />

      {/* Stage background */}
      <div
        style={{
          position: "absolute",
          left: STAGE_X,
          top: 0,
          width: STAGE_WIDTH,
          height: 1080,
          backgroundColor: "#16213e",
          borderLeft: "2px solid #333",
          borderRight: "2px solid #333",
        }}
      >
        {/* Column dividers */}
        {COLUMN_POSITIONS.slice(1).map((pos, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: pos - STAGE_X,
              top: 0,
              width: 2,
              height: 1080,
              backgroundColor: "#2a2a4a",
            }}
          />
        ))}

        {/* Lane effects - subtle gradient per column */}
        {COLUMN_POSITIONS.map((pos, i) => (
          <div
            key={`lane-${i}`}
            style={{
              position: "absolute",
              left: pos - COLUMN_WIDTH / 2 - STAGE_X,
              top: 0,
              width: COLUMN_WIDTH,
              height: 1080,
              background: `linear-gradient(180deg, transparent 0%, ${
                ["rgba(255,107,107,0.05)", "rgba(78,205,196,0.05)", "rgba(69,183,209,0.05)", "rgba(150,206,180,0.05)"][i]
              } 50%, transparent 100%)`,
            }}
          />
        ))}
      </div>

      {/* Judgment line */}
      <div
        style={{
          position: "absolute",
          left: STAGE_X,
          top: JUDGMENT_LINE_Y,
          width: STAGE_WIDTH,
          height: 4,
          backgroundColor: "#00ff88",
          boxShadow: "0 0 15px #00ff88",
        }}
      />

      {/* Key press indicators at bottom */}
      {COLUMN_POSITIONS.map((pos, i) => (
        <div
          key={`key-${i}`}
          style={{
            position: "absolute",
            left: STAGE_X + pos - COLUMN_WIDTH / 2,
            top: JUDGMENT_LINE_Y + 10,
            width: COLUMN_WIDTH,
            height: 60,
            backgroundColor: "#2a2a4a",
            borderRadius: "0 0 8 8",
            border: "2px solid #444",
            borderTop: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            fontWeight: "bold",
            color: "#666",
          }}
        >
          {["D", "F", "J", "K"][i]}
        </div>
      ))}

      {/* Notes */}
      {hitObjects.map((note, index) => (
        <ManiaNote
          key={`${note.time}-${note.column}-${index}`}
          note={note}
          approachRate={difficulty.approachRate}
        />
      ))}

      {/* Metadata display */}
      <div
        style={{
          position: "absolute",
          top: 30,
          left: 30,
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 36, fontWeight: "bold", marginBottom: 8 }}>
          {metadata.titleUnicode || metadata.title}
        </div>
        <div style={{ fontSize: 24, color: "#aaa", marginBottom: 4 }}>
          {metadata.artistUnicode || metadata.artist}
        </div>
        <div style={{ fontSize: 18, color: "#666" }}>
          {metadata.creator} [{metadata.version}]
        </div>
        <div style={{ fontSize: 16, color: "#555", marginTop: 8 }}>
          {difficulty.circleSize}K | AR {difficulty.approachRate} | OD {difficulty.overallDifficulty}
        </div>
      </div>

      {/* Score/Combo display */}
      <div
        style={{
          position: "absolute",
          top: 30,
          right: 30,
          color: "white",
          fontFamily: "monospace",
          fontSize: 32,
          textAlign: "right",
        }}
      >
        <div style={{ color: "#00ff88" }}>1,000,000</div>
        <div style={{ fontSize: 18, color: "#666" }}>x1.0</div>
      </div>
    </AbsoluteFill>
  );
};
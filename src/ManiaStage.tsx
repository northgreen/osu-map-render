import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ParsedBeatmap, TimingPoint } from "./lib/osuParser";
import { ManiaNote } from "./ManiaNote";

interface ManiaStageProps {
  beatmap?: ParsedBeatmap;
}

// Stage dimensions - match osu!mania coordinates
const COLUMN_POSITIONS = [64, 192, 320, 448];
const COLUMN_WIDTH = 128;
const STAGE_WIDTH = 512;
const STAGE_X = 64; // Start at first column position
const STAGE_HEIGHT = 1080;
const JUDGMENT_LINE_Y = 900;

// Generate beat lines based on timing points
function generateBeatLines(timingPoints: TimingPoint[], durationMs: number): number[] {
  const beatLines: number[] = [];
  if (timingPoints.length === 0) return beatLines;

  // Get all uninherited timing points (these define BPM)
  const uninheritedPoints = timingPoints.filter(tp => tp.uninherited);
  if (uninheritedPoints.length === 0) return beatLines;

  // For each uninherited timing point, generate beat lines
  for (let i = 0; i < uninheritedPoints.length; i++) {
    const tp = uninheritedPoints[i];
    const nextTp = uninheritedPoints[i + 1];
    const endTime = nextTp ? nextTp.time : durationMs + 5000;

    const msPerBeat = Math.abs(tp.beatLength);

    // Generate beat lines from this TP's time until next TP
    for (let time = tp.time; time < endTime; time += msPerBeat) {
      if (time > 0) beatLines.push(time);
    }
  }

  return beatLines;
}

export const ManiaStage: React.FC<ManiaStageProps> = ({ beatmap }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!beatmap) {
    return (
      <AbsoluteFill style={{ backgroundColor: "#1a1a2e", justifyContent: "center", alignItems: "center" }}>
        <div style={{ color: "white", fontSize: 24 }}>No beatmap loaded</div>
      </AbsoluteFill>
    );
  }

  const { metadata, difficulty, hitObjects, timingPoints, backgroundImage } = beatmap;
  const currentTime = (frame / fps) * 1000;
  const durationMs = beatmap.hitObjects.length > 0
    ? beatmap.hitObjects[beatmap.hitObjects.length - 1].endTime || beatmap.hitObjects[beatmap.hitObjects.length - 1].time
    : 60000;

  // Generate beat lines
  const beatLines = generateBeatLines(timingPoints, durationMs);

  // Calculate visible time based on AR
  const visibleTime = difficulty.approachRate < 5
    ? 1200 + (5 - difficulty.approachRate) * 120
    : difficulty.approachRate > 5
    ? 1200 - (difficulty.approachRate - 5) * 120
    : 1200;

  // Get the background image filename from beatmap
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
          <img
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

      {/* Audio */}
      <Audio src={staticFile("audio.mp3")} />

      {/* Beat lines */}
      {beatLines.map((time, i) => {
        const timeUntilHit = time - currentTime;
        if (timeUntilHit > visibleTime || timeUntilHit < -500) return null;

        const progress = 1 - timeUntilHit / visibleTime;
        const y = progress * JUDGMENT_LINE_Y;
        const isBarLine = i % 4 === 0; // Every 4 beats is a bar

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: STAGE_X,
              top: y,
              width: STAGE_WIDTH,
              height: isBarLine ? 2 : 1,
              backgroundColor: isBarLine ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)",
              opacity: Math.max(0, Math.min(1, 1 - timeUntilHit / 500)),
            }}
          />
        );
      })}

      {/* Stage background */}
      <div
        style={{
          position: "absolute",
          left: STAGE_X,
          top: 0,
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
          backgroundColor: "#16213e",
          borderLeft: "2px solid #444",
          borderRight: "2px solid #444",
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

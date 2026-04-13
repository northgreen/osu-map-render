import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ParsedBeatmap, TimingPoint } from "./lib/osuParser";
import { ManiaNote } from "./ManiaNote";
import {
  COLUMN_POSITIONS_STAGE,
  COLUMN_WIDTH,
  NOTE_HEIGHT,
  STAGE_WIDTH,
  STAGE_X,
  STAGE_HEIGHT,
  JUDGMENT_LINE_Y,
  HIT_EFFECT_DURATION,
} from "./config";

interface ManiaStageProps {
  beatmap?: ParsedBeatmap;
}

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
        {COLUMN_POSITIONS_STAGE.slice(1).map((pos, i) => (
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
        {
        //   COLUMN_POSITIONS_STAGE.map((pos, i) => (
        //   <div
        //     key={`lane-${i}`}
        //     style={{
        //       position: "absolute",
        //       left: pos - COLUMN_WIDTH / 2 - STAGE_X,
        //       top: 0,
        //       width: COLUMN_WIDTH,
        //       height: 1080,
        //       opacity: 0.2,
        //       background: `linear-gradient(180deg, transparent 0%, ${
        //         ["#FF6B6B", "#4ECDC4", "#4ECDC4", "#FF6B6B"][i]
        //       } 50%, transparent 100%)`,
        //     }}
        //   />
        // ))
        }
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
      {COLUMN_POSITIONS_STAGE.map((pos, i) => (
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

      {/* Hit effects - column highlight */}
      {hitObjects.map((note, index) => {
        const startTime = note.time;
        const endTime = note.isLongNote && note.endTime ? note.endTime : note.time + HIT_EFFECT_DURATION;

        // For LN: column stays lit while held
        // For regular note: light up for HIT_EFFECT_DURATION ms after hit with fade out
        const isActive = note.isLongNote
          ? (currentTime >= startTime && currentTime <= endTime)
          : (currentTime >= startTime && currentTime < startTime + HIT_EFFECT_DURATION);

        if (isActive) {
          const column = Math.min(note.column, 3);
          const posX = COLUMN_POSITIONS_STAGE[column];
          const colors = ["#FF6B6B", "#4ECDC4", "#4ECDC4", "#FF6B6B"];
          const color = colors[column];

          // Calculate fade out for regular notes
          const timeSinceHit = currentTime - startTime;
          const fadeProgress = note.isLongNote ? 0 : (timeSinceHit / HIT_EFFECT_DURATION);
          const opacity = note.isLongNote
            ? Math.min(0.2, (endTime - currentTime) / 200 + 0.3)
            : 0.1 * (1 - fadeProgress);

          return (
            <div
              key={`col-hit-${startTime}-${note.column}-${index}`}
              style={{
                position: "absolute",
                left: STAGE_X + posX - COLUMN_WIDTH / 2,
                top: 0,
                width: COLUMN_WIDTH,
                height: 1080,
                backgroundColor: color,
                opacity,
                pointerEvents: "none",
              }}
            />
          );
        }
        return null;
      })}

      {/* Hit effects - note flash */}
      {hitObjects.map((note, index) => {
        const column = Math.min(note.column, 3);
        const posX = COLUMN_POSITIONS_STAGE[column];
        const colors = ["#FF6B6B", "#4ECDC4", "#4ECDC4", "#FF6B6B"];
        const color = colors[column];

        // For LN: flash at head and tail
        // For regular note: flash once
        const flashTimes = note.isLongNote && note.endTime
          ? [note.time, note.endTime]
          : [note.time];

        return (
          <>
            {flashTimes.map((flashTime, flashIndex) => {
              const timeSinceHit = currentTime - flashTime;

              // Show effect for HIT_EFFECT_DURATION ms after flash with fade out
              if (timeSinceHit >= 0 && timeSinceHit < HIT_EFFECT_DURATION) {
                const progress = timeSinceHit / HIT_EFFECT_DURATION;

                return (
                  <div
                    key={`hit-${flashTime}-${note.column}-${index}-${flashIndex}`}
                    style={{
                      position: "absolute",
                      left: STAGE_X + posX - COLUMN_WIDTH / 2,
                      top: JUDGMENT_LINE_Y,
                      width: COLUMN_WIDTH,
                      height: NOTE_HEIGHT,
                      backgroundColor: color,
                      opacity: 1 - progress,
                      borderRadius: 4,
                      boxShadow: `0 0 ${20 * (1 - progress)}px ${color}`,
                    }}
                  />
                );
              }
              return null;
            })}
          </>
        );
      })}

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

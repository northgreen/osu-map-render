import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ParsedBeatmap, TimingPoint } from "./lib/osuParser";
import { ManiaNote } from "./ManiaNote";
import { ReplayCursor } from "./ReplayCursor";
import { replay } from "./lib/replay";
import {
  SCROLL_SPEED as DEFAULT_SCROLL_SPEED,
  COLUMN_POSITIONS_STAGE,
  COLUMN_WIDTH,
  NOTE_HEIGHT,
  STAGE_WIDTH,
  STAGE_X,
  STAGE_HEIGHT,
  JUDGMENT_LINE_Y,
  HIT_EFFECT_DURATION,
} from "./config";

interface ManiaStageLayerProps {
  beatmap?: ParsedBeatmap;
  scrollSpeed?: number;
  beatOffset?: number;
}

// Generate beat lines based on timing points
function generateBeatLines(timingPoints: TimingPoint[], durationMs: number): number[] {
  const beatLines: number[] = [];
  if (timingPoints.length === 0) return beatLines;

  const uninheritedPoints = timingPoints.filter(tp => tp.uninherited);
  if (uninheritedPoints.length === 0) return beatLines;

  for (let i = 0; i < uninheritedPoints.length; i++) {
    const tp = uninheritedPoints[i];
    const nextTp = uninheritedPoints[i + 1];
    const endTime = nextTp ? nextTp.time : durationMs + 5000;

    const msPerBeat = Math.abs(tp.beatLength);

    for (let time = tp.time; time < endTime; time += msPerBeat) {
      if (time > 0) beatLines.push(time);
    }
  }

  return beatLines;
}

export const ManiaStageLayer: React.FC<ManiaStageLayerProps> = ({
  beatmap,
  scrollSpeed = DEFAULT_SCROLL_SPEED,
  beatOffset = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!beatmap) {
    return null;
  }

  const { hitObjects, timingPoints } = beatmap;
  // currentTime is the actual playback time in ms
  const currentTime = (frame / fps) * 1000;

  const durationMs = hitObjects.length > 0
    ? (hitObjects[hitObjects.length - 1].endTime || hitObjects[hitObjects.length - 1].time) + 5000
    : 60000;

  // Calculate visible time based on AR and scroll speed
  const difficulty = beatmap.difficulty;
  const baseVisibleTime = difficulty.approachRate < 5
    ? 1200 + (5 - difficulty.approachRate) * 120
    : difficulty.approachRate > 5
    ? 1200 - (difficulty.approachRate - 5) * 120
    : 1200;
  const visibleTime = baseVisibleTime * (10 / scrollSpeed);

  // Generate beat lines
  const beatLines = generateBeatLines(timingPoints, durationMs);

  // Get pressed keys from replay
  const getPressedKeys = () => {
    const pressedColumns: boolean[] = [false, false, false, false];
    if (!replay?.replayData) return pressedColumns;

    // Calculate cumulative times - just sum up timeOffsets like osu does
    let cumulativeTime = 0;
    const times: number[] = [];

    for (let i = 0; i < replay.replayData.length; i++) {
      cumulativeTime += replay.replayData[i].timeOffset;
      times.push(cumulativeTime);
    }

    for (let i = 0; i < times.length; i++) {
      const time = times[i];
      if (time < 0) continue;
      if (time > currentTime) break;

      const keys = replay.replayData[i].x;
      if (keys >= 0 && keys < 16) {
        for (let col = 0; col < 4; col++) {
          if ((keys & (1 << col)) !== 0) {
            pressedColumns[col] = true;
          }
        }
      }
    }
    return pressedColumns;
  };

  const pressedKeys = getPressedKeys();

  return (
    <AbsoluteFill>
      {/* Beat lines */}
      {beatLines.map((time, i) => {
        const timeUntilHit = time - currentTime;
        if (timeUntilHit > visibleTime || timeUntilHit < -500) return null;

        const progress = 1 - timeUntilHit / visibleTime;
        const y = progress * JUDGMENT_LINE_Y;
        const isBarLine = i % 4 === 0;

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

      {/* Notes */}
      {hitObjects.map((note, index) => (
        <ManiaNote
          key={`${note.time}-${note.column}-${index}`}
          note={note}
          scrollSpeed={scrollSpeed}
        />
      ))}

      {/* Replay cursor - shows player key presses falling */}
      <ReplayCursor scrollSpeed={scrollSpeed} />

      {/* Key press indicators at bottom */}
      {COLUMN_POSITIONS_STAGE.map((pos, i) => {
        const isPressed = pressedKeys[i];
        const colors = ["#FF6B6B", "#4ECDC4", "#4ECDC4", "#FF6B6B"];
        const color = colors[i];
        return (
          <div
            key={`key-${i}`}
            style={{
              position: "absolute",
              left: STAGE_X + pos - COLUMN_WIDTH / 2,
              top: JUDGMENT_LINE_Y + 10,
              width: COLUMN_WIDTH,
              height: 60,
              backgroundColor: isPressed ? color : "#2a2a4a",
              opacity: isPressed ? 0.8 : 1,
              borderRadius: "0 0 8 8",
              border: `2px solid ${isPressed ? color : "#444"}`,
              borderTop: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: "bold",
              color: isPressed ? "#fff" : "#666",
              boxShadow: isPressed ? `0 0 20px ${color}` : "none",
              transition: "all 0.05s",
            }}
          >
            {["D", "F", "J", "K"][i]}
          </div>
        );
      })}

      {/* Column highlights when key is pressed */}
      {COLUMN_POSITIONS_STAGE.map((pos, i) => {
        const isPressed = pressedKeys[i];
        if (!isPressed) return null;

        const colors = ["#FF6B6B", "#4ECDC4", "#4ECDC4", "#FF6B6B"];
        const color = colors[i];

        return (
          <div
            key={`col-highlight-${i}`}
            style={{
              position: "absolute",
              left: STAGE_X + pos - COLUMN_WIDTH / 2,
              top: 0,
              width: COLUMN_WIDTH,
              height: 1080,
              backgroundColor: color,
              opacity: 0.15,
              pointerEvents: "none",
            }}
          />
        );
      })}

      {/* Hit effects - column highlight on note hit */}
      {hitObjects.map((note, index) => {
        const startTime = note.time;
        const endTime = note.isLongNote && note.endTime ? note.endTime : note.time + HIT_EFFECT_DURATION;

        const isActive = note.isLongNote
          ? (currentTime >= startTime && currentTime <= endTime)
          : (currentTime >= startTime && currentTime < startTime + HIT_EFFECT_DURATION);

        if (!isActive) return null;

        const column = Math.min(note.column, 3);
        const posX = COLUMN_POSITIONS_STAGE[column];
        const colors = ["#FF6B6B", "#4ECDC4", "#4ECDC4", "#FF6B6B"];
        const color = colors[column];

        const timeSinceHit = currentTime - startTime;
        const fadeProgress = note.isLongNote ? 0 : (timeSinceHit / HIT_EFFECT_DURATION);
        const opacity = note.isLongNote
          ? Math.min(0.1, (endTime - currentTime) / HIT_EFFECT_DURATION + 0.01)
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
      })}

      {/* Hit effects - note flash */}
      {hitObjects.map((note, index) => {
        const column = Math.min(note.column, 3);
        const posX = COLUMN_POSITIONS_STAGE[column];
        const colors = ["#FF6B6B", "#4ECDC4", "#4ECDC4", "#FF6B6B"];
        const color = colors[column];

        const flashTimes = note.isLongNote && note.endTime
          ? [note.time, note.endTime]
          : [note.time];

        return (
          <>
            {flashTimes.map((flashTime, flashIndex) => {
              const timeSinceHit = currentTime - flashTime;

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
    </AbsoluteFill>
  );
};

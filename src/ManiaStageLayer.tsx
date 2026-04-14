import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ParsedBeatmap, TimingPoint } from "./lib/osuParser";
import { ManiaNote } from "./ManiaNote";
import { ReplayCursor } from "./ReplayCursor";
import { replay } from "./lib/replay";
import { getHitWindows, getJudgmentMode, getJudgmentOffset } from "./lib/judgment";
import {
  SCROLL_SPEED as DEFAULT_SCROLL_SPEED,
  COLUMN_POSITIONS_STAGE,
  COLUMN_POSITIONS_NOTE,
  COLUMN_WIDTH,
  NOTE_WIDTH,
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
  showJudgmentZones?: boolean;
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
  showJudgmentZones = false,
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

  // Calculate visible time based on AR and scroll speed - use consistent BASE_VISIBLE_TIME
  const difficulty = beatmap.difficulty;
  const baseVisibleTime = 1800; // Same as config.ts BASE_VISIBLE_TIME
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
            className="beat-line"
            style={{
              top: y,
              height: isBarLine ? 2 : 1,
              backgroundColor: isBarLine ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)",
              opacity: Math.max(0, Math.min(1, 1 - timeUntilHit / 500)),
            }}
          />
        );
      })}

      {/* Stage background */}
      <div
        className="stage-container"
      >
        {/* Column dividers */}
        {COLUMN_POSITIONS_STAGE.slice(1).map((pos, i) => (
          <div
            key={i}
            className="column-divider"
            style={{
              left: pos - STAGE_X,
              width: 2,
            }}
          />
        ))}
      </div>

      {/* Judgment line */}
      <div
        className="judgment-line"
        style={{
          top: JUDGMENT_LINE_Y,
          width: STAGE_WIDTH,
          height: 4,
          backgroundColor: "#00ff88",
          boxShadow: "0 0 15px #00ff88",
        }}
      />

      {/* Judgment zones - colored rectangles showing timing windows */}
      {showJudgmentZones && visibleTime > 0 && hitObjects.map((note, index) => {
        const timeUntilHit = note.time - currentTime;
        // Show zones for notes that are about to hit (within visible time)
        if (timeUntilHit > visibleTime || timeUntilHit < -200) return null;

        const od = beatmap.difficulty.overallDifficulty;
        const windows = getHitWindows(od);

        // Calculate note position
        const progress = 1 - timeUntilHit / visibleTime;
        const noteY = progress * JUDGMENT_LINE_Y;
        if (isNaN(noteY)) return null;

        // Judgment zone colors (from center outward)
        const zoneColors = [
          { color: "rgba(255, 0, 255, 0.3)", borderColor: "rgba(255, 0, 255, 0.8)", window: windows.perfect },   // Magenta - Perfect
          { color: "rgba(0, 255, 136, 0.25)", borderColor: "rgba(0, 255, 136, 0.6)", window: windows.great },  // Green - Great
          { color: "rgba(0, 170, 255, 0.2)", borderColor: "rgba(0, 170, 255, 0.5)", window: windows.good },  // Blue - Good
          { color: "rgba(255, 170, 0, 0.15)", borderColor: "rgba(255, 170, 0, 0.4)", window: windows.ok },  // Orange - Ok
          { color: "rgba(255, 68, 68, 0.12)", borderColor: "rgba(255, 68, 68, 0.3)", window: windows.meh },  // Red - Meh
        ];

        const column = Math.min(note.column, 3);
        const posX = COLUMN_POSITIONS_NOTE[column];

        // Calculate zone heights based on time windows (converted to pixels)
        const msToPixels = (ms: number) => {
          if (visibleTime <= 0 || isNaN(ms)) return 0;
          return (ms / visibleTime) * JUDGMENT_LINE_Y;
        };

        // Render zones centered on note - extends both above and below
        // Zone starts from noteY, extends upward (early) and downward (late)
        let zoneTop = noteY;
        return (
          <div key={`note-zones-${note.time}-${note.column}-${index}`}>
            {zoneColors.map((zone, zoneIndex) => {
              const zoneHeight = msToPixels(zone.window);
              if (zoneHeight <= 0) return null;

              // Calculate fade based on screen position
              const fadeStart = 100;
              const opacity = Math.min(1, Math.max(0.1, (zoneTop - fadeStart) / fadeStart + 1));

              const currentTop = zoneTop - zoneHeight;
              zoneTop -= zoneHeight;

              return (
                <>
                  {/* Zone extends upward from previous zone (early hit window) */}
                  <div
                    key={`zone-early-${note.time}-${note.column}-${index}-${zoneIndex}`}
                    className={`judgment-zone zone-${zoneIndex}`}
                    style={{
                      left: posX - NOTE_WIDTH / 2 + 2,
                      top: currentTop,
                      width: NOTE_WIDTH - 4,
                      height: zoneHeight - 1,
                      opacity,
                    }}
                  />
                </>
              );
            })}
            {/* Render late zones below note */}
            {zoneColors.map((zone, zoneIndex) => {
              const zoneHeight = msToPixels(zone.window);
              if (zoneHeight <= 0) return null;

              const startY = noteY + msToPixels(zoneColors.slice(0, zoneIndex).reduce((sum, z) => sum + msToPixels(z.window), 0));
              const opacity = Math.min(1, Math.max(0.1, (startY - 100) / 100 + 1));

              return (
                <div
                  key={`zone-late-${note.time}-${note.column}-${index}-${zoneIndex}`}
                  className={`judgment-zone zone-${zoneIndex}`}
                  style={{
                    left: posX - NOTE_WIDTH / 2 + 2,
                    top: startY,
                    width: NOTE_WIDTH - 4,
                    height: zoneHeight - 1,
                    opacity,
                  }}
                />
              );
            })}
          </div>
        );
      })}

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
        return (
          <div
            key={`key-${i}`}
            className={`key-indicator column-${i} ${isPressed ? 'pressed' : ''}`}
            style={{
              left: STAGE_X + pos - COLUMN_WIDTH / 2,
              top: JUDGMENT_LINE_Y + 10,
              width: COLUMN_WIDTH,
              height: 60,
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

        return (
          <div
            key={`col-highlight-${i}`}
            className={`column-highlight column-${i}`}
            style={{
              left: STAGE_X + pos - COLUMN_WIDTH / 2,
              width: COLUMN_WIDTH,
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

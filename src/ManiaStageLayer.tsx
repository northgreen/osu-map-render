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
  stageOffset?: number;
  judgmentLineY?: number;
  showReplayCursor?: boolean;
  showJudgmentLine?: boolean;
  showBeatLines?: boolean;
  showColumnHighlights?: boolean;
}

// Generate beat lines based on timing points
function generateBeatLines(timingPoints: TimingPoint[], durationMs: number): number[] {
  const beatLines: number[] = [];
  if (timingPoints.length === 0) return beatLines;

  const uninheritedPoints = timingPoints.filter(tp => tp.uninherited);
  if (uninheritedPoints.length === 0) return beatLines;

  // Start from the earliest timing point and go backwards to cover the beginning
  const firstTp = uninheritedPoints[0];
  const msPerBeat = Math.abs(firstTp.beatLength);

  // Generate beat lines from time 0 to the first timing point
  for (let time = 0; time < firstTp.time; time += msPerBeat) {
    if (time > 0) beatLines.push(time);
  }

  // Then generate beat lines from first timing point onwards
  for (let i = 0; i < uninheritedPoints.length; i++) {
    const tp = uninheritedPoints[i];
    const nextTp = uninheritedPoints[i + 1];
    const endTime = nextTp ? nextTp.time : durationMs + 5000;

    const beatLength = Math.abs(tp.beatLength);

    for (let time = tp.time; time < endTime; time += beatLength) {
      if (time > firstTp.time) beatLines.push(time);  // Avoid duplicates
    }
  }

  return beatLines;
}

export const ManiaStageLayer: React.FC<ManiaStageLayerProps> = ({
  beatmap,
  scrollSpeed = DEFAULT_SCROLL_SPEED,
  beatOffset = 0,
  showJudgmentZones = false,
  stageOffset = 0,
  judgmentLineY = JUDGMENT_LINE_Y,
  showReplayCursor = true,
  showJudgmentLine = true,
  showBeatLines = true,
  showColumnHighlights = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Debug: log props at frame 0
  if (frame === 0) {
    console.log("ManiaStageLayer props:", { stageOffset, judgmentLineY, scrollSpeed, showReplayCursor, showJudgmentLine, showBeatLines, showColumnHighlights });
  }

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

  // Compute actual positions with offsets
  const stageX = STAGE_X + stageOffset;
  const judgmentY = judgmentLineY;

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

    // Find the last frame at or before currentTime
    let lastFrameIndex = -1;
    for (let i = times.length - 1; i >= 0; i--) {
      if (times[i] <= currentTime) {
        lastFrameIndex = i;
        break;
      }
    }

    if (lastFrameIndex >= 0) {
      const keys = replay.replayData[lastFrameIndex].x;
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

  // Get key release times for fade-out effect
  const getReleaseTimes = () => {
    const releaseTimes: number[] = [0, 0, 0, 0];
    if (!replay?.replayData) return releaseTimes;

    let cumulativeTime = 0;
    const times: number[] = [];

    for (let i = 0; i < replay.replayData.length; i++) {
      cumulativeTime += replay.replayData[i].timeOffset;
      times.push(cumulativeTime);
    }

    const keyState = [false, false, false, false];

    for (let i = 0; i < times.length; i++) {
      const time = times[i];
      // Only record release times that are before or at current time
      if (time > currentTime) break;

      const keys = replay.replayData[i].x;

      for (let col = 0; col < 4; col++) {
        const isPressed = (keys & (1 << col)) !== 0;

        if (!isPressed && keyState[col]) {
          releaseTimes[col] = time;
        }
        keyState[col] = isPressed;
      }
    }

    return releaseTimes;
  };

  const releaseTimes = getReleaseTimes();
  const COLUMN_FADE_DURATION = 150;

  const getColumnOpacity = (columnIndex: number, isPressed: boolean) => {
    if (isPressed) return 0.15;

    const releaseTime = releaseTimes[columnIndex];
    // If releaseTime is 0, it means the key was never pressed - don't show highlight
    if (releaseTime === 0) return 0;

    const timeSinceRelease = currentTime - releaseTime;
    if (timeSinceRelease < 0 || timeSinceRelease > COLUMN_FADE_DURATION) return 0;

    return 0.15 * (1 - timeSinceRelease / COLUMN_FADE_DURATION);
  };

  return (
    <AbsoluteFill>
      {/* Beat lines */}
      {showBeatLines && beatLines.map((time, i) => {
        // Apply beatOffset so beat lines start appearing at the right time
        const adjustedTime = time + beatOffset;
        const timeUntilHit = adjustedTime - currentTime;

        // Only show when above judgment line (add small buffer to prevent flickering)
        if (timeUntilHit < -16 || timeUntilHit > visibleTime) return null;

        const progress = 1 - timeUntilHit / visibleTime;
        const y = progress * judgmentY;
        const beatNumber = 60;
        const isBarLine = beatNumber % 4 === 0;

        return (
          <div
            key={`beat-${time}`}
            className={`beat-line ${isBarLine ? 'bar' : 'normal'}`}
            style={{
              left: stageX,
              top: y,
              height: isBarLine ? 3 : 1,
            }}
          />
        );
      })}

      {/* Stage background */}
      <div
        className="stage-container"
        style={{
          left: stageX,
        }}
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
      {showJudgmentLine && (
      <div
        className="judgment-line"
        style={{
          left: stageX,
          top: judgmentY,
          width: STAGE_WIDTH,
          height: 4,
          backgroundColor: "#00ff88",
          boxShadow: "0 0 15px #00ff88",
        }}
      />
      )}

      {/* Judgment zones - colored rectangles showing timing windows */}
      {showJudgmentZones && visibleTime > 0 && hitObjects.map((note, index) => {
        const timeUntilHit = note.time - currentTime;
        // Show zones for notes that are about to hit (within visible time)
        if (timeUntilHit > visibleTime || timeUntilHit < -200) return null;

        const od = beatmap.difficulty.overallDifficulty;
        const windows = getHitWindows(od);

        // Calculate note position
        const progress = 1 - timeUntilHit / visibleTime;
        const noteY = progress * judgmentY;
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
          return (ms / visibleTime) * judgmentY;
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
          judgmentLineY={judgmentLineY}
          stageOffset={stageOffset}
        />
      ))}

      {/* Replay cursor - shows player key presses falling */}
      {showReplayCursor && <ReplayCursor scrollSpeed={scrollSpeed} stageOffset={stageOffset} judgmentLineY={judgmentLineY} />}

      {/* Key press indicators at bottom */}
      {COLUMN_POSITIONS_STAGE.map((pos, i) => {
        const isPressed = pressedKeys[i];
        const colors = ["#FF6B6B", "#4ECDC4", "#4ECDC4", "#FF6B6B"];
        return (
          <div
            key={`key-${i}`}
            className={`key-indicator column-${i} ${isPressed ? 'pressed' : ''}`}
            style={{
              left: stageX + pos - COLUMN_WIDTH / 2,
              top: judgmentY + 10,
              width: COLUMN_WIDTH,
              height: 60,
            }}
          >
            {["D", "F", "J", "K"][i]}
          </div>
        );
      })}

      {/* Column highlights when key is pressed (with fade-out) */}
      {showColumnHighlights && COLUMN_POSITIONS_STAGE.map((pos, i) => {
        const isPressed = pressedKeys[i];
        const opacity = getColumnOpacity(i, isPressed);

        if (opacity <= 0) return null;

        return (
          <div
            key={`col-highlight-${i}`}
            className={`column-highlight column-${i}`}
            style={{
              left: stageX + pos - COLUMN_WIDTH / 2,
              width: COLUMN_WIDTH,
              opacity,
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
          ? Math.min(0.1, (endTime - currentTime) / HIT_EFFECT_DURATION + 0.0)
          : 0.1 * (1 - fadeProgress);

        return (
          <div
            key={`col-hit-${startTime}-${note.column}-${index}`}
            style={{
              position: "absolute",
              left: stageX + posX - COLUMN_WIDTH / 2,
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
                      left: stageX + posX - COLUMN_WIDTH / 2,
                      top: judgmentY,
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

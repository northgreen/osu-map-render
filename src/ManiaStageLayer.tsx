import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo } from "react";
import { ParsedBeatmap, TimingPoint } from "./lib/osuParser";
import { ManiaNote } from "./ManiaNote";
import { ReplayCursor } from "./ReplayCursor";
import { SequentialScrollAlgorithm } from "./lib/scrollVelocity";
import { replay } from "./lib/replay";
import { getHitWindows, isAutoplayMode, getKeyIntervals } from "./lib/judgment";
import {
  SCROLL_SPEED as DEFAULT_SCROLL_SPEED,
  NOTE_WIDTH,
  NOTE_HEIGHT,
  STAGE_X,
  JUDGMENT_LINE_Y,
  HIT_EFFECT_DURATION,
  config,
  getKeyCount,
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
  stageBgOpacity?: number;
}

// Generate beat lines based on timing points
function generateBeatLines(
  timingPoints: TimingPoint[],
  durationMs: number,
): number[] {
  const beatLines: number[] = [];
  if (timingPoints.length === 0) return beatLines;

  const uninheritedPoints = timingPoints.filter((tp) => tp.uninherited);
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
      if (time > firstTp.time) beatLines.push(time); // Avoid duplicates
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
  stageBgOpacity = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Handle missing beatmap - return placeholder (all hooks above this line)
  const { hitObjects, timingPoints } = beatmap || {
    hitObjects: [],
    timingPoints: [],
  };
  const currentTime = beatmap ? (frame / fps) * 1000 : 0;

  const durationMs =
    hitObjects.length > 0
      ? (hitObjects[hitObjects.length - 1].endTime ||
          hitObjects[hitObjects.length - 1].time) + 5000
      : 60000;

  // Calculate visible time based on AR and scroll speed - use consistent BASE_VISIBLE_TIME
  const baseVisibleTime = 1800; // Same as config.ts BASE_VISIBLE_TIME
  const visibleTime = baseVisibleTime * (10 / scrollSpeed);

  const scrollAlgorithm = useMemo(() => {
    const svSegments = beatmap?.scrollVelocitySegments;
    if (svSegments && svSegments.length > 0) {
      return new SequentialScrollAlgorithm(svSegments, visibleTime);
    }
    return null;
  }, [beatmap?.scrollVelocitySegments, visibleTime]);

  // Compute actual positions with offsets
  const stageX = STAGE_X + stageOffset;
  const judgmentY = judgmentLineY;

  // Set CSS variables for stage positioning
  const stageStyle = {
    "--stage-x": `${stageX}px`,
    "--stage-width": `${config.stageWidth}px`,
  } as React.CSSProperties;

  // Generate beat lines (memoized - static data)
  const beatLines = useMemo(
    () => generateBeatLines(timingPoints, durationMs),
    [timingPoints, durationMs],
  );

  // Cache cumulative times array (computed once)
  const cumulativeTimes = useMemo(() => {
    if (!replay?.replayData) return [];
    const times: number[] = [];
    let cumulativeTime = 0;
    for (let i = 0; i < replay.replayData.length; i++) {
      cumulativeTime += replay.replayData[i].timeOffset;
      times.push(cumulativeTime);
    }
    return times;
  }, []);

  // Binary search helper: find rightmost index where arr[i] <= value
  function bisectRight(arr: number[], value: number): number {
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (arr[mid] <= value) lo = mid + 1;
      else hi = mid;
    }
    return lo - 1;
  }

  // Get pressed keys from replay or autoplay
  const pressedKeys = useMemo(() => {
    const keyCount = getKeyCount();
    const pressedColumns = new Array(keyCount).fill(false) as boolean[];

    if (isAutoplayMode()) {
      // Autoplay: use key intervals from judgment module
      const intervals = getKeyIntervals(hitObjects);
      for (const interval of intervals) {
        if (currentTime >= interval.start && currentTime <= interval.end) {
          pressedColumns[interval.column] = true;
        }
      }
    } else if (replay?.replayData && cumulativeTimes.length > 0) {
      const lastFrameIndex = bisectRight(cumulativeTimes, currentTime);
      if (lastFrameIndex >= 0) {
        const keys = replay.replayData[lastFrameIndex].x;
        for (let col = 0; col < keyCount; col++) {
          if ((keys & (1 << col)) !== 0) {
            pressedColumns[col] = true;
          }
        }
      }
    }

    return pressedColumns;
  }, [cumulativeTimes, currentTime, hitObjects]);

  // Get key release times for fade-out effect
  const releaseTimes = useMemo(() => {
    const keyCount = getKeyCount();
    const result = new Array(keyCount).fill(0) as number[];

    if (isAutoplayMode()) {
      // Autoplay: track when keys are released based on intervals
      const intervals = getKeyIntervals(hitObjects);
      const keyState = new Array(keyCount).fill(false) as boolean[];

      // Sort intervals by start time
      const sortedIntervals = [...intervals].sort((a, b) => a.start - b.start);

      for (const interval of sortedIntervals) {
        if (interval.start > currentTime) break;

        const col = interval.column;
        if (interval.end <= currentTime) {
          // Key was released
          if (keyState[col]) {
            result[col] = interval.end;
            keyState[col] = false;
          }
        } else if (interval.start <= currentTime) {
          // Key is currently pressed
          keyState[col] = true;
        }
      }
    } else if (replay?.replayData && cumulativeTimes.length > 0) {
      const keyState = new Array(keyCount).fill(false) as boolean[];

      for (let i = 0; i < cumulativeTimes.length; i++) {
        const time = cumulativeTimes[i];
        if (time > currentTime) break;

        const keys = replay.replayData[i].x;

        for (let col = 0; col < keyCount; col++) {
          const isPressed = (keys & (1 << col)) !== 0;

          if (!isPressed && keyState[col]) {
            result[col] = time;
          }
          keyState[col] = isPressed;
        }
      }
    }

    return result;
  }, [cumulativeTimes, currentTime, hitObjects]);

  const COLUMN_FADE_DURATION = 150;

  // Early return after all hooks
  if (!beatmap) {
    return null;
  }

  const getColumnOpacity = (columnIndex: number, isPressed: boolean) => {
    if (isPressed) return 0.15;

    const releaseTime = releaseTimes[columnIndex];
    // If releaseTime is 0, it means the key was never pressed - don't show highlight
    if (releaseTime === 0) return 0;

    const timeSinceRelease = currentTime - releaseTime;
    if (timeSinceRelease < 0 || timeSinceRelease > COLUMN_FADE_DURATION)
      return 0;

    return 0.15 * (1 - timeSinceRelease / COLUMN_FADE_DURATION);
  };

  return (
    <AbsoluteFill style={stageStyle}>
      {/* Beat lines */}
      {showBeatLines &&
        beatLines.map((time) => {
          const adjustedTime = time + beatOffset;
          const timeUntilHit = adjustedTime - currentTime;

          if (timeUntilHit < -16 || timeUntilHit > visibleTime) return null;

          const progress = scrollAlgorithm
            ? scrollAlgorithm.getProgress(time, currentTime)
            : 1 - timeUntilHit / visibleTime;
          const y = progress * judgmentY;
          const isBarLine =
            time === 0 ||
            (timingPoints.length > 0 &&
              time % (Math.abs(timingPoints[0].beatLength) * 4) === 0);

          return (
            <div
              key={`beat-${time}`}
              className={`beat-line ${isBarLine ? "bar" : "normal"}`}
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
          opacity: stageBgOpacity,
        }}
      >
        {/* Column dividers */}
        {config.columnPositionsStage.slice(1).map((pos, i) => (
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
            width: config.stageWidth,
            height: 4,
            backgroundColor: "#00ff88",
            boxShadow: "0 0 15px #00ff88",
          }}
        />
      )}

      {/* Judgment zones - colored rectangles showing timing windows */}
      {showJudgmentZones &&
        visibleTime > 0 &&
        hitObjects.map((note, index) => {
          const timeUntilHit = note.time - currentTime;
          // Show zones for notes that are about to hit (within visible time)
          if (timeUntilHit > visibleTime || timeUntilHit < -200) return null;

          const od = beatmap.difficulty.overallDifficulty;
          const windows = getHitWindows(od);

          // Calculate note position
          const progress = scrollAlgorithm
            ? scrollAlgorithm.getProgress(note.time, currentTime)
            : 1 - timeUntilHit / visibleTime;
          const noteY = progress * judgmentY;
          if (isNaN(noteY)) return null;

          // Judgment zone colors (from center outward)
          const zoneColors = [
            {
              color: "rgba(255, 0, 255, 0.3)",
              borderColor: "rgba(255, 0, 255, 0.8)",
              window: windows.perfect,
            }, // Magenta - Perfect
            {
              color: "rgba(0, 255, 136, 0.25)",
              borderColor: "rgba(0, 255, 136, 0.6)",
              window: windows.great,
            }, // Green - Great
            {
              color: "rgba(0, 170, 255, 0.2)",
              borderColor: "rgba(0, 170, 255, 0.5)",
              window: windows.good,
            }, // Blue - Good
            {
              color: "rgba(255, 170, 0, 0.15)",
              borderColor: "rgba(255, 170, 0, 0.4)",
              window: windows.ok,
            }, // Orange - Ok
            {
              color: "rgba(255, 68, 68, 0.12)",
              borderColor: "rgba(255, 68, 68, 0.3)",
              window: windows.meh,
            }, // Red - Meh
          ];

          const column = Math.min(
            note.column,
            config.columnPositionsNote.length - 1,
          );
          // Use config.columnPositionsNote + stageOffset to match note positioning (same as ManiaNote)
          const posX =
            STAGE_X + config.columnPositionsNote[column] + stageOffset;

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
                const opacity = Math.min(
                  1,
                  Math.max(0.1, (zoneTop - fadeStart) / fadeStart + 1),
                );

                const currentTop = zoneTop - zoneHeight;
                zoneTop -= zoneHeight;

                return (
                  <>
                    {/* Zone extends upward from previous zone (early hit window) */}
                    <div
                      key={`zone-early-${note.time}-${note.column}-${index}-${zoneIndex}`}
                      className={`judgment-zone zone-${zoneIndex}`}
                      style={{
                        left: posX + 2, // posX already includes stageOffset
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

                const startY =
                  noteY +
                  msToPixels(
                    zoneColors
                      .slice(0, zoneIndex)
                      .reduce((sum, z) => sum + msToPixels(z.window), 0),
                  );
                const opacity = Math.min(
                  1,
                  Math.max(0.1, (startY - 100) / 100 + 1),
                );

                return (
                  <div
                    key={`zone-late-${note.time}-${note.column}-${index}-${zoneIndex}`}
                    className={`judgment-zone zone-${zoneIndex}`}
                    style={{
                      left: posX + 2, // posX already includes stageOffset
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
          scrollAlgorithm={scrollAlgorithm}
          judgmentLineY={judgmentLineY}
          stageOffset={stageOffset}
        />
      ))}

      {/* Replay cursor - shows player key presses falling */}
      {showReplayCursor && (
        <ReplayCursor
          scrollSpeed={scrollSpeed}
          scrollAlgorithm={scrollAlgorithm}
          stageOffset={stageOffset}
          judgmentLineY={judgmentLineY}
        />
      )}

      {/* Key press indicators at bottom */}
      {config.columnPositionsStage.map((pos, i) => {
        const isPressed = pressedKeys[i];
        const keyLabels = [
          "D",
          "F",
          "J",
          "K",
          "A",
          "S",
          "Z",
          "X",
          "C",
          "V",
          "B",
          "N",
          "M",
          ",",
          ".",
          "/",
          "'",
          ";",
          "L",
        ];
        return (
          <div
            key={`key-${i}`}
            className={`key-indicator column-${i} ${isPressed ? "pressed" : ""}`}
            style={{
              left: stageX + pos - config.columnWidth / 2,
              top: judgmentY + 10,
              width: config.columnWidth,
              height: 60,
            }}
          >
            {keyLabels[i] ?? i}
          </div>
        );
      })}

      {/* Column highlights when key is pressed (with fade-out) */}
      {showColumnHighlights &&
        config.columnPositionsStage.map((pos, i) => {
          const isPressed = pressedKeys[i];
          const opacity = getColumnOpacity(i, isPressed);

          if (opacity <= 0) return null;

          return (
            <div
              key={`col-highlight-${i}`}
              className={`column-highlight column-${i}`}
              style={{
                left: stageX + pos - config.columnWidth / 2,
                width: config.columnWidth,
                opacity,
              }}
            />
          );
        })}

      {/* Hit effects - column highlight on note hit */}
      {hitObjects.map((note, index) => {
        const startTime = note.time;
        const endTime =
          note.isLongNote && note.endTime
            ? note.endTime
            : note.time + HIT_EFFECT_DURATION;

        const isActive = note.isLongNote
          ? currentTime >= startTime && currentTime <= endTime
          : currentTime >= startTime &&
            currentTime < startTime + HIT_EFFECT_DURATION;

        if (!isActive) return null;

        const column = Math.min(
          note.column,
          config.columnPositionsStage.length - 1,
        );
        const posX = config.columnPositionsStage[column];
        const color = config.columnColors[column];

        const timeSinceHit = currentTime - startTime;
        const fadeProgress = note.isLongNote
          ? 0
          : timeSinceHit / HIT_EFFECT_DURATION;
        const opacity = note.isLongNote
          ? Math.min(0.1, (endTime - currentTime) / HIT_EFFECT_DURATION + 0.0)
          : 0.1 * (1 - fadeProgress);

        return (
          <div
            key={`col-hit-${startTime}-${note.column}-${index}`}
            style={{
              position: "absolute",
              left: stageX + posX - config.columnWidth / 2,
              top: 0,
              width: config.columnWidth,
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
        const column = Math.min(
          note.column,
          config.columnPositionsStage.length - 1,
        );
        const posX = config.columnPositionsStage[column];
        const color = config.columnColors[column];

        const flashTimes =
          note.isLongNote && note.endTime
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
                      left: stageX + posX - config.columnWidth / 2,
                      top: judgmentY,
                      width: config.columnWidth,
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

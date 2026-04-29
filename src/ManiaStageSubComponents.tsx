import { useMemo } from "react";
import { SequentialScrollAlgorithm } from "./lib/scrollVelocity";
import { TimingPoint, ParsedBeatmap } from "./lib/osuParser";
import { getHitWindows } from "./lib/judgment";
import {
  NOTE_WIDTH,
  NOTE_HEIGHT,
  HIT_EFFECT_DURATION,
  config,
} from "./config";

// ============================================
// BeatLinesLayer
// ============================================

/** Props for the beat line rendering layer */
export interface BeatLinesLayerProps {
  /** Pre-computed beat line times from timing points */
  beatLines: number[];
  /** Millisecond offset applied to all beat line times */
  beatOffset: number;
  /** Current playback time in milliseconds */
  currentTime: number;
  /** Visible time window in milliseconds */
  visibleTime: number;
  /** Y position of the judgment line in pixels */
  judgmentY: number;
  /** Left edge of the stage in pixels */
  readonly stageX: number;
  /** Scroll velocity algorithm (nullable) */
  scrollAlgorithm: SequentialScrollAlgorithm | null;
  /** Timing points for bar line detection */
  timingPoints: TimingPoint[];
}

/**
 * Render beat lines — horizontal lines marking beat boundaries.
 * Bar lines (every 4 beats) are thicker. Lines outside the visible
 * time window are culled.
 */
export const BeatLinesLayer: React.FC<BeatLinesLayerProps> = ({
  beatLines,
  beatOffset,
  currentTime,
  visibleTime,
  judgmentY,
  stageX,
  scrollAlgorithm,
  timingPoints,
}) => {
  return (
    <>
      {beatLines.map((time) => {
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
    </>
  );
};

// ============================================
// JudgmentZonesLayer
// ============================================

/** Props for the judgment zones rendering layer */
export interface JudgmentZonesLayerProps {
  /** Hit objects to render zones for */
  hitObjects: ParsedBeatmap["hitObjects"];
  /** Current playback time in milliseconds */
  currentTime: number;
  /** Visible time window in milliseconds */
  visibleTime: number;
  /** Y position of the judgment line in pixels */
  judgmentY: number;
  /** Left edge of the stage in pixels (STAGE_X + stageOffset) */
  stageX: number;
  /** Parsed beatmap (for difficulty/OD) */
  beatmap: ParsedBeatmap;
  /** Scroll velocity algorithm (nullable) */
  scrollAlgorithm: SequentialScrollAlgorithm | null;
}

/**
 * Render judgment zone rectangles — colored overlays showing hit windows
 * around each note. Zones extend upward (early) and downward (late) from
 * the note position, with colors progressing from magenta (perfect) to
 * red (meh).
 */
export const JudgmentZonesLayer: React.FC<JudgmentZonesLayerProps> = ({
  hitObjects,
  currentTime,
  visibleTime,
  judgmentY,
  stageX,
  beatmap,
  scrollAlgorithm,
}) => {
  const od = beatmap.difficulty.overallDifficulty;
  const windows = getHitWindows(od);

  const zoneColors = [
    {
      color: "rgba(255, 0, 255, 0.3)",
      borderColor: "rgba(255, 0, 255, 0.8)",
      window: windows.perfect,
    },
    {
      color: "rgba(0, 255, 136, 0.25)",
      borderColor: "rgba(0, 255, 136, 0.6)",
      window: windows.great,
    },
    {
      color: "rgba(0, 170, 255, 0.2)",
      borderColor: "rgba(0, 170, 255, 0.5)",
      window: windows.good,
    },
    {
      color: "rgba(255, 170, 0, 0.15)",
      borderColor: "rgba(255, 170, 0, 0.4)",
      window: windows.ok,
    },
    {
      color: "rgba(255, 68, 68, 0.12)",
      borderColor: "rgba(255, 68, 68, 0.3)",
      window: windows.meh,
    },
  ];

  const msToPixels = useMemo(
    () => (ms: number) => {
      if (visibleTime <= 0 || Number.isNaN(ms)) return 0;
      return (ms / visibleTime) * judgmentY;
    },
    [visibleTime, judgmentY],
  );

  return (
    <>
      {hitObjects.map((note, index) => {
        const timeUntilHit = note.time - currentTime;
        if (timeUntilHit > visibleTime || timeUntilHit < -200) return null;

        const progress = scrollAlgorithm
          ? scrollAlgorithm.getProgress(note.time, currentTime)
          : 1 - timeUntilHit / visibleTime;
        const noteY = progress * judgmentY;
        if (Number.isNaN(noteY)) return null;

        const column = Math.min(
          note.column,
          config.columnPositionsNote.length - 1,
        );
        const posX = stageX + config.columnPositionsNote[column];

        let zoneTop = noteY;
        return (
          <div key={`note-zones-${note.time}-${note.column}-${index}`}>
            {zoneColors.map((zone, zoneIndex) => {
              const zoneHeight = msToPixels(zone.window);
              if (zoneHeight <= 0) return null;

              const fadeStart = 100;
              const opacity = Math.min(
                1,
                Math.max(0.1, (zoneTop - fadeStart) / fadeStart + 1),
              );

              const currentTop = zoneTop - zoneHeight;
              zoneTop -= zoneHeight;

              return (
                <div
                  key={`zone-early-${note.time}-${note.column}-${index}-${zoneIndex}`}
                  className={`judgment-zone zone-${zoneIndex}`}
                  style={{
                    left: posX + 2,
                    top: currentTop,
                    width: NOTE_WIDTH - 4,
                    height: zoneHeight - 1,
                    opacity,
                  }}
                />
              );
            })}
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
                    left: posX + 2,
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
    </>
  );
};

// ============================================
// KeyIndicatorsLayer
// ============================================

/** Props for the key press indicator layer */
export interface KeyIndicatorsLayerProps {
  /** Whether each column key is currently pressed */
  pressedKeys: boolean[];
  /** Y position of the judgment line in pixels */
  judgmentY: number;
  /** Left edge of the stage in pixels */
  stageX: number;
}

/** Keyboard labels mapped to column index for osu!mania default keybinds */
const KEY_LABELS = [
  "D", "F", "J", "K", "A", "S", "Z", "X", "C",
  "V", "B", "N", "M", ",", ".", "/", "'", ";", "L",
];

/**
 * Render key press indicator boxes at the bottom of the stage.
 * Active indicators are filled with the column color and glow.
 */
export const KeyIndicatorsLayer: React.FC<KeyIndicatorsLayerProps> = ({
  pressedKeys,
  judgmentY,
  stageX,
}) => {
  return (
    <>
      {config.columnPositionsStage.map((pos, i) => {
        const isPressed = pressedKeys[i];
        return (
          <div
            key={`key-${i}`}
            className={`key-indicator ${isPressed ? "pressed" : ""}`}
            style={{
              left: stageX + pos - config.columnWidth / 2,
              top: judgmentY + 10,
              width: config.columnWidth,
              height: 60,
              backgroundColor: isPressed ? config.columnColors[i] : undefined,
              borderColor: isPressed ? config.columnColors[i] : undefined,
              boxShadow: isPressed
                ? `0 0 20px ${config.columnColors[i]}`
                : undefined,
            }}
          >
            {KEY_LABELS[i] ?? i}
          </div>
        );
      })}
    </>
  );
};

// ============================================
// ColumnHighlightsLayer
// ============================================

/** Props for the column highlight layer */
export interface ColumnHighlightsLayerProps {
  /** Whether each column key is currently pressed */
  pressedKeys: boolean[];
  /** Release timestamp per column (0 = never pressed) */
  releaseTimes: number[];
  /** Current playback time in milliseconds */
  currentTime: number;
  /** Left edge of the stage in pixels */
  stageX: number;
}

const COLUMN_FADE_DURATION = 150;

/**
 * Compute column highlight opacity based on key state.
 * Pressed keys show a solid highlight; released keys fade out.
 */
function getColumnOpacity(
  columnIndex: number,
  isPressed: boolean,
  releaseTimes: number[],
  currentTime: number,
): number {
  if (isPressed) return 0.15;

  const releaseTime = releaseTimes[columnIndex];
  if (releaseTime === 0) return 0;

  const timeSinceRelease = currentTime - releaseTime;
  if (timeSinceRelease < 0 || timeSinceRelease > COLUMN_FADE_DURATION) return 0;

  return 0.15 * (1 - timeSinceRelease / COLUMN_FADE_DURATION);
}

/**
 * Render column-wide highlight bars that appear when keys are pressed
 * and fade out after release. Used for visual feedback on hit timing.
 */
export const ColumnHighlightsLayer: React.FC<ColumnHighlightsLayerProps> = ({
  pressedKeys,
  releaseTimes,
  currentTime,
  stageX,
}) => {
  return (
    <>
      {config.columnPositionsStage.map((pos, i) => {
        const isPressed = pressedKeys[i];
        const opacity = getColumnOpacity(
          i,
          isPressed,
          releaseTimes,
          currentTime,
        );

        if (opacity <= 0) return null;

        return (
          <div
            key={`col-highlight-${i}`}
            className="column-highlight"
            style={{
              left: stageX + pos - config.columnWidth / 2,
              width: config.columnWidth,
              opacity,
              backgroundColor: config.columnColors[i],
            }}
          />
        );
      })}
    </>
  );
};

// ============================================
// HitEffectsLayer
// ============================================

/** Props for the hit effects layer */
export interface HitEffectsLayerProps {
  /** Hit objects to render effects for */
  hitObjects: ParsedBeatmap["hitObjects"];
  /** Current playback time in milliseconds */
  currentTime: number;
  /** Left edge of the stage in pixels */
  stageX: number;
  /** Y position of the judgment line in pixels */
  judgmentY: number;
}

/**
 * Render hit effects: column-wide color flash when a note is hit,
 * plus a per-note flash at the judgment line. LN bodies sustain
 * the column highlight for their duration.
 */
export const HitEffectsLayer: React.FC<HitEffectsLayerProps> = ({
  hitObjects,
  currentTime,
  stageX,
  judgmentY,
}) => {
  return (
    <>
      {/* Column highlight on note hit */}
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
          ? Math.min(0.1, (endTime - currentTime) / HIT_EFFECT_DURATION)
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

      {/* Note flash at judgment line */}
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
    </>
  );
};

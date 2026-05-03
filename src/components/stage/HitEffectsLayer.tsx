import { ParsedBeatmap } from "../../lib/osuParser";
import {
  NOTE_HEIGHT,
  HIT_EFFECT_DURATION,
  config,
} from "../../config";

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

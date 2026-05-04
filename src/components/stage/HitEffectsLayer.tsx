import React, { useMemo } from "react";
import { ParsedBeatmap } from "../../lib/osuParser";
import {
  NOTE_HEIGHT,
  HIT_EFFECT_DURATION,
  config,
} from "../../config";
import { bisectRight } from "../../lib/utils";

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
  /** Visible time window in milliseconds — only notes in this window are processed */
  visibleTime: number;
}

/**
 * Render hit effects: column-wide color flash when a note is hit,
 * plus a per-note flash at the judgment line. LN bodies sustain
 * the column highlight for their duration.
 *
 * Performance: pre-filters hitObjects via binary search so only
 * notes in the visible time window are iterated over (30–50 notes
 * instead of 3000+).
 */
export const HitEffectsLayer: React.FC<HitEffectsLayerProps> = ({
  hitObjects,
  currentTime,
  stageX,
  judgmentY,
  visibleTime,
}) => {
  // Pre-filter: only process notes whose time falls within the visible window
  // hitObjects is sorted by time, so binary search is O(log n)
  const visibleHitObjects = useMemo(() => {
    if (hitObjects.length === 0) return hitObjects;

    const times = hitObjects.map((n) => n.time);
    const margin = HIT_EFFECT_DURATION + 2000; // 30ms flash + 2s LN body lookback
    const earliestTime = currentTime - margin - visibleTime;
    const latestTime = currentTime + visibleTime;

    // bisectRight returns last index where arr[i] <= value, or -1 if none
    // First index where time >= earliestTime
    const leftIdx = Math.max(0, bisectRight(times, earliestTime - 0.001) + 1);
    // Last index where time <= latestTime
    const rightIdx = bisectRight(times, latestTime);

    // No notes in window
    if (leftIdx > rightIdx || rightIdx < 0) return [];

    const result = hitObjects.slice(leftIdx, rightIdx + 1);

    // Scan backwards from leftIdx for active LNs whose startTime is
    // before earliestTime but are still being held
    const seen = new Set(result.map((n) => `${n.time}-${n.column}`));
    for (let i = leftIdx - 1; i >= 0; i--) {
      const note = hitObjects[i];
      if (!note.isLongNote || !note.endTime) continue;
      const key = `${note.time}-${note.column}`;
      if (seen.has(key)) continue;
      if (note.endTime >= currentTime && note.time <= currentTime) {
        result.push(note);
        seen.add(key);
      }
      // Safety limit: scan at most 500 notes back
      if (leftIdx - i > 500) break;
    }

    return result;
  }, [hitObjects, currentTime, visibleTime]);

  return (
    <>
      {/* Column highlight on note hit */}
      {visibleHitObjects.map((note, index) => {
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
      {visibleHitObjects.map((note, index) => {
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
          <React.Fragment key={`note-${note.time}-${note.column}-${index}`}>
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
          </React.Fragment>
        );
      })}
    </>
  );
};

import { useMemo } from "react";
import { SequentialScrollAlgorithm } from "../../lib/scrollVelocity";
import { TimingPoint } from "../../lib/osuParser";
import { bisectRight } from "../../lib/utils";

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
 * Bar lines (every `meter` beats per the active timing point) are thicker.
 * Lines outside the visible time window are culled.
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
  // Pre-compute uninherited timing points for binary search
  const { uninheritedPoints, uninheritedTimes } = useMemo(() => {
    const points = timingPoints.filter(tp => tp.uninherited);
    return {
      uninheritedPoints: points,
      uninheritedTimes: points.map(p => p.time),
    };
  }, [timingPoints]);

  return (
    <>
      {beatLines.map((time) => {
        const adjustedTime = time + beatOffset;
        const timeUntilHit = adjustedTime - currentTime;

        if (timeUntilHit < -16 || timeUntilHit > visibleTime) return null;

        const progress = scrollAlgorithm
          ? scrollAlgorithm.getProgress(adjustedTime, currentTime)
          : 1 - timeUntilHit / visibleTime;
        const y = progress * judgmentY;

        // Find active timing point via binary search on pre-sorted uninherited points
        const tpIdx = bisectRight(uninheritedTimes, time);
        const activeTp = tpIdx >= 0 ? uninheritedPoints[tpIdx] : null;
        const beatLength = activeTp ? Math.abs(activeTp.beatLength) : 0;
        const meter = activeTp?.meter ?? 4;
        const isBarLine =
          time === 0 ||
          (beatLength > 0 &&
            meter > 0 &&
            Math.abs(time % Math.round(beatLength * meter)) < 0.001);

        return (
          <div
            key={`beat-${time}`}
            className={`beat-line ${isBarLine ? "bar" : "normal"}`}
            style={{
              left: stageX,
              top: y,
            }}
          />
        );
      })}
    </>
  );
};

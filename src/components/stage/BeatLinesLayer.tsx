import { SequentialScrollAlgorithm } from "../../lib/scrollVelocity";
import { TimingPoint } from "../../lib/osuParser";

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

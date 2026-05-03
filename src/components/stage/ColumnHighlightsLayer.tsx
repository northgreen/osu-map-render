import { config } from "../../config";

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

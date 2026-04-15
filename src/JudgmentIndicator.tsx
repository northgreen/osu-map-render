import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { HitObject } from "./lib/osuParser";
import {
  SCROLL_SPEED,
  BASE_VISIBLE_TIME,
  NOTE_HEIGHT,
  NOTE_WIDTH,
  JUDGMENT_LINE_Y,
  config,
} from "./config";
import { getJudgmentResults, JudgmentResult, getJudgmentColor, clearJudgmentCache } from "./lib/judgment";

function getVisibleTime(scrollSpeed: number): number {
  return BASE_VISIBLE_TIME * (10 / scrollSpeed);
}

const VISIBLE_TIME = getVisibleTime(SCROLL_SPEED);

interface JudgmentIndicatorProps {
  hitObjects: HitObject[];
  od: number;
  currentTime: number;
}

export const JudgmentIndicator: React.FC<JudgmentIndicatorProps> = ({
  hitObjects,
  od,
  currentTime,
}) => {
  // Get all judgment results
  const judgments = getJudgmentResults(hitObjects, od);

  const indicators: JSX.Element[] = [];

  for (let i = 0; i < judgments.length; i++) {
    const j = judgments[i];

    // Skip if not in visible range
    const timeUntilNote = j.noteTime - currentTime;
    if (timeUntilNote > VISIBLE_TIME || timeUntilNote < -500) continue;

    const progress = 1 - timeUntilNote / VISIBLE_TIME;
    if (progress < 0 || progress > 1.2) continue;

    const y = interpolate(progress, [0, 1], [-NOTE_HEIGHT, JUDGMENT_LINE_Y]);
    const color = getJudgmentColor(j.judgment);

    // For regular notes, don't show judgment indicator (just show at hit moment)
    // But for LNs, show at both head and tail
    if (!j.isLongNote) {
      // Show briefly when note is hit (around judgment line)
      if (Math.abs(timeUntilNote) < 100) {
        const posX = config.columnPositionsNote[j.column];
        indicators.push(
          <div
            key={`judge-${i}`}
            style={{
              position: "absolute",
              left: posX - NOTE_WIDTH / 2,
              top: y,
              width: NOTE_WIDTH,
              height: NOTE_HEIGHT,
              backgroundColor: color,
              opacity: 0.8,
              borderRadius: 4,
              boxShadow: `0 0 15px ${color}`,
              zIndex: 50,
            }}
          />
        );
      }
      continue;
    }

    // For LNs: show at head
    const headY = y;
    const posX = COLUMN_POSITIONS_NOTE[j.column];

    // Head indicator
    indicators.push(
      <div
        key={`judge-head-${i}`}
        style={{
          position: "absolute",
          left: posX - NOTE_WIDTH / 2,
          top: headY,
          width: NOTE_WIDTH,
          height: NOTE_HEIGHT,
          backgroundColor: color,
          opacity: 0.6,
          borderRadius: 4,
          border: `3px solid ${color}`,
          boxShadow: `0 0 10px ${color}`,
          zIndex: 50,
        }}
      />
    );

    // Tail indicator (if LN has end time)
    if (j.endTime) {
      const tailTimeUntil = j.endTime - currentTime;
      const tailProgress = 1 - tailTimeUntil / VISIBLE_TIME;

      if (tailProgress >= 0 && tailProgress <= 1.2) {
        const tailY = interpolate(tailProgress, [0, 1], [-NOTE_HEIGHT, JUDGMENT_LINE_Y]);

        indicators.push(
          <div
            key={`judge-tail-${i}`}
            style={{
              position: "absolute",
              left: posX - NOTE_WIDTH / 2,
              top: tailY,
              width: NOTE_WIDTH,
              height: NOTE_HEIGHT,
              backgroundColor: color,
              opacity: 0.6,
              borderRadius: 4,
              border: `3px solid ${color}`,
              boxShadow: `0 0 10px ${color}`,
              zIndex: 50,
            }}
          />
        );
      }
    }
  }

  return <>{indicators}</>;
};

// Export function to clear cache when needed
export { clearJudgmentCache };
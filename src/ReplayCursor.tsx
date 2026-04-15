import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { replay } from "./lib/replay";
import { getKeyIntervals } from "./lib/judgment";
import { getJudgmentResults, getJudgmentColor, JudgmentResult } from "./lib/judgment";
import { beatmap } from "./lib/osuParser";
import {
  SCROLL_SPEED as DEFAULT_SCROLL_SPEED,
  BASE_VISIBLE_TIME,
  NOTE_HEIGHT,
  NOTE_WIDTH,
  JUDGMENT_LINE_Y,
  COLUMN_POSITIONS_STAGE,
  STAGE_X,
  COLUMN_COLORS,
} from "./config";

function getVisibleTime(scrollSpeed: number): number {
  return BASE_VISIBLE_TIME * (10 / scrollSpeed);
}

interface ReplayCursorProps {
  scrollSpeed?: number;
  stageOffset?: number;
  judgmentLineY?: number;
}

export const ReplayCursor: React.FC<ReplayCursorProps> = ({
  scrollSpeed = DEFAULT_SCROLL_SPEED,
  stageOffset = 0,
  judgmentLineY: jy = JUDGMENT_LINE_Y,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = (frame / fps) * 1000;

  const VISIBLE_TIME = getVisibleTime(scrollSpeed);

  if (!replay?.replayData || replay.replayData.length === 0) {
    return null;
  }

  const keyIntervals = getKeyIntervals();
  const cursors: JSX.Element[] = [];

  // Get judgment results for coloring
  const judgments = getJudgmentResults(beatmap?.hitObjects || [], beatmap?.difficulty?.overallDifficulty || 7.5);

  // Find visible intervals
  const visibleEnd = currentTime + VISIBLE_TIME;
  const visibleStart = currentTime - 200;

  for (let i = 0; i < keyIntervals.length; i++) {
    const interval = keyIntervals[i];

    // Skip if interval is completely outside visible range
    if (interval.end < visibleStart || interval.start > visibleEnd) continue;

    // Calculate progress for start and end times
    const startProgress = 1 - (interval.start - currentTime) / VISIBLE_TIME;
    const endProgress = 1 - (interval.end - currentTime) / VISIBLE_TIME;

    // Calculate Y positions
    const clampedStartProgress = Math.max(0, Math.min(1, startProgress));
    const clampedEndProgress = Math.max(0, Math.min(1, endProgress));

    const startY = interpolate(clampedStartProgress, [0, 1], [-NOTE_HEIGHT, jy]);
    const endY = interpolate(clampedEndProgress, [0, 1], [-NOTE_HEIGHT, jy]);

    // Skip if the rendered height would be negative or too small
    const height = Math.abs(startY - endY);
    if (height < 2) continue;

    const posX = COLUMN_POSITIONS_STAGE[interval.column];
    const baseColor = COLUMN_COLORS[interval.column];

    // Find head judgment (key press)
    let headJudgmentColor = baseColor;
    let isLN = false;
    const pressTime = interval.start;

    // Find tail judgment (key release)
    let tailJudgmentColor = baseColor;
    const releaseTime = interval.end;

    for (const j of judgments) {
      // Head judgment: match by note time and column
      if (j.column === interval.column && Math.abs(j.noteTime - pressTime) < 50) {
        headJudgmentColor = getJudgmentColor(j.judgment);
        isLN = j.isLongNote;
      }
      // Tail judgment: only for LN, match by end time
      if (j.column === interval.column && j.isLongNote && j.endTime && Math.abs(j.noteTime - releaseTime) < 50) {
        tailJudgmentColor = getJudgmentColor(j.judgment);
      }
    }

    // Main bar - use head color
    const barColor = headJudgmentColor;

    // Main bar
    cursors.push(
      <div
        key={`key-bar-${i}`}
        style={{
          position: "absolute",
          left: STAGE_X + stageOffset + posX - 15,
          top: Math.min(startY, endY),
          width: 30,
          height: height,
          backgroundColor: barColor,
          opacity: 0.4,
          borderRadius: 50,
          border: `2px solid ${barColor}`,
          boxShadow: `0 0 10px ${barColor}`,
          pointerEvents: "none",
          zIndex: 100,
        }}
      />
    );

    // Circle at start (key press) - always show for both single notes and LN
    cursors.push(
      <div
        key={`key-start-${i}`}
        style={{
          position: "absolute",
          left: STAGE_X + stageOffset + posX - 12,
          top: startY - 12,
          width: 24,
          height: 24,
          borderRadius: "50%",
          backgroundColor: headJudgmentColor,
          border: "3px solid white",
          boxShadow: `0 0 15px ${headJudgmentColor}`,
          pointerEvents: "none",
          zIndex: 101,
        }}
      />
    );

    // Circle at end (key release) - only show for LN (long notes)
    if (isLN) {
      cursors.push(
        <div
          key={`key-end-${i}`}
          style={{
            position: "absolute",
            left: STAGE_X + stageOffset + posX - 12,
            top: endY - 12,
            width: 24,
            height: 24,
            borderRadius: "50%",
            backgroundColor: tailJudgmentColor,
            border: "3px solid white",
            boxShadow: `0 0 15px ${tailJudgmentColor}`,
            pointerEvents: "none",
            zIndex: 101,
          }}
        />
      );
    }
  }

  return <>{cursors}</>;
};
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { replay } from "./lib/replay";
import {
  SCROLL_SPEED as DEFAULT_SCROLL_SPEED,
  BASE_VISIBLE_TIME,
  NOTE_HEIGHT,
  NOTE_WIDTH,
  JUDGMENT_LINE_Y,
  COLUMN_POSITIONS_STAGE,
  STAGE_X,
} from "./config";

function getVisibleTime(scrollSpeed: number): number {
  return BASE_VISIBLE_TIME * (10 / scrollSpeed);
}

interface ReplayCursorProps {
  scrollSpeed?: number;
}

// Find all key press intervals (press time, release time, column)
function getKeyPressIntervals() {
  const intervals: { start: number; end: number; column: number }[] = [];

  if (!replay?.replayData) return intervals;

  // Calculate cumulative times - just sum up timeOffsets like osu does
  let cumulativeTime = 0;
  const times: number[] = [];

  for (let i = 0; i < replay.replayData.length; i++) {
    const frame = replay.replayData[i];
    cumulativeTime += frame.timeOffset;
    times.push(cumulativeTime);
  }

  // Debug
  console.log("ReplayCursor first 10 times:", times.slice(0, 10));

  // Track key state per column
  const keyState = [false, false, false, false];
  const keyStartTime = [0, 0, 0, 0];

  for (let i = 0; i < replay.replayData.length; i++) {
    const frame = replay.replayData[i];
    const currentTime = times[i];
    const keys = frame.x; // Use x field for mania key press bitmask

    for (let col = 0; col < 4; col++) {
      const isPressed = (keys & (1 << col)) !== 0;

      if (isPressed && !keyState[col]) {
        keyState[col] = true;
        keyStartTime[col] = currentTime;
      } else if (!isPressed && keyState[col]) {
        keyState[col] = false;
        if (keyStartTime[col] > 0) {
          intervals.push({
            start: keyStartTime[col],
            end: currentTime,
            column: col,
          });
        }
      }
    }
  }

  return intervals;
}

let keyIntervalsCache: { start: number; end: number; column: number }[] | null = null;

function getKeyIntervals(): { start: number; end: number; column: number }[] {
  if (keyIntervalsCache) return keyIntervalsCache;
  keyIntervalsCache = getKeyPressIntervals();
  return keyIntervalsCache;
}

export const ReplayCursor: React.FC<ReplayCursorProps> = ({ scrollSpeed = DEFAULT_SCROLL_SPEED }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = (frame / fps) * 1000;

  const VISIBLE_TIME = getVisibleTime(scrollSpeed);

  // Debug at frame 0
  if (frame === 0) {
    console.log("ReplayCursor START, frames:", replay?.replayData?.length);
    const intervals = getKeyPressIntervals();
    console.log("Key intervals found:", intervals.length);
  }

  if (!replay?.replayData || replay.replayData.length === 0) {
    return null;
  }

  const keyIntervals = getKeyIntervals();
  const cursors: JSX.Element[] = [];

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

    const startY = interpolate(clampedStartProgress, [0, 1], [-NOTE_HEIGHT, JUDGMENT_LINE_Y]);
    const endY = interpolate(clampedEndProgress, [0, 1], [-NOTE_HEIGHT, JUDGMENT_LINE_Y]);

    // Skip if the rendered height would be negative or too small
    const height = Math.abs(startY - endY);
    if (height < 2) continue;

    const posX = COLUMN_POSITIONS_STAGE[interval.column];
    const colors = ["#6978c2", "#6978c2", "#6978c2", "#6978c2"];
    const color = colors[interval.column];

    cursors.push(
      <div
        key={`key-${i}`}
        style={{
          position: "absolute",
          left: STAGE_X + posX - NOTE_WIDTH / 4,
          top: Math.min(startY, endY),
          width: 30,
          height: height,
          backgroundColor: color,
          opacity: 0.4,
          borderRadius: 50,
          border: "2px solid white",
          boxShadow: `0 0 10px ${color}`,
          pointerEvents: "none",
          zIndex: 100,
        }}
      />
    );
  }

  return <>{cursors}</>;
};
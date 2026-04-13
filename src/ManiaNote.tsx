import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { HitObject } from "./lib/osuParser";

interface ManiaNoteProps {
  note: HitObject;
}

const COLUMN_POSITIONS = [120, 257, 385, 513];
const NOTE_WIDTH = 100;
const NOTE_HEIGHT = 40;
const JUDGMENT_LINE_Y = 900;

// osu!mania scroll speed (玩家自定)
// 常见值: 10 (默认), 15, 20, 25, 30, 40 等
// 数值越大，流速越快
const SCROLL_SPEED = 20;

// Base visible time at scroll speed 10
const BASE_VISIBLE_TIME = 1800; // ms

// Calculate visible time based on scroll speed
function getVisibleTime(scrollSpeed: number): number {
  // scrollSpeed=10 → 1800ms, scrollSpeed=20 → 900ms, etc.
  return BASE_VISIBLE_TIME * (10 / scrollSpeed);
}

export const ManiaNote: React.FC<ManiaNoteProps> = ({ note }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const VISIBLE_TIME = getVisibleTime(SCROLL_SPEED);
  const currentTime = (frame / fps) * 1000;

  const { isLongNote, endTime, time: startTime } = note;
  const timeUntilStart = startTime - currentTime;
  const timeUntilEnd = isLongNote && endTime ? endTime - currentTime : timeUntilStart;

  // For LN, visible if either head OR tail is in range
  // For regular note, visible if timeUntilStart is in range
  const isVisible = isLongNote && endTime
    ? (timeUntilStart <= VISIBLE_TIME && timeUntilEnd >= -200)
    : (timeUntilStart <= VISIBLE_TIME && timeUntilStart >= -200);

  if (!isVisible) {
    return null;
  }

  // Column position
  const column = Math.min(note.column, 3);
  const x = COLUMN_POSITIONS[column] - NOTE_WIDTH / 2;

  // Note color based on column
  const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4"];
  const color = colors[column];

  // === Render Long Note ===
  if (isLongNote && endTime) {
    const headProgress = 1 - timeUntilStart / VISIBLE_TIME;
    const tailProgress = 1 - timeUntilEnd / VISIBLE_TIME;

    // Clamp progress to valid range (0 = at top, 1 = at judgment line)
    const clampedHeadProgress = Math.max(0, Math.min(1, headProgress));
    const clampedTailProgress = Math.max(0, Math.min(1, tailProgress));

    // Head position: from top (-NOTE_HEIGHT) to judgment line
    const headY = interpolate(clampedHeadProgress, [0, 1], [-NOTE_HEIGHT, JUDGMENT_LINE_Y]);

    // Tail position: from top to judgment line
    const tailY = interpolate(clampedTailProgress, [0, 1], [-NOTE_HEIGHT, JUDGMENT_LINE_Y]);

    // Body: always connects head bottom to tail top
    // Only visible when both head and tail have appeared
    const bodyTop = headY + NOTE_HEIGHT;  // Bottom of head note
    const bodyBottom = tailY;               // Top of tail
    const bodyHeight = bodyTop - bodyBottom;

    const headIsHit = Math.abs(timeUntilStart) < 50;
    const tailIsHit = Math.abs(timeUntilEnd) < 50;

    const headOpacity = headIsHit ? 1 : Math.min(1, clampedHeadProgress * 1.5);
    const tailOpacity = tailIsHit ? 1 : Math.min(1, clampedTailProgress * 1.5);

    // Body is visible when head has appeared, and tail hasn't passed too far
    // bodyHeight > 0 means tail is below head (normal case)
    const showBody = headProgress > 0 && timeUntilEnd > -500 && bodyHeight > 0;

    return (
      <>
        {/* Head note - always visible when in range */}
        <div
          style={{
            position: "absolute",
            left: x,
            top: headY,
            width: NOTE_WIDTH,
            height: NOTE_HEIGHT,
            backgroundColor: color,
            borderRadius: 4,
            opacity: headOpacity,
            boxShadow: headIsHit ? `0 0 20px ${color}` : "none",
          }}
        />
        {/* LN Body - connects head to tail */}
        {showBody && (
          <div
            style={{
              position: "absolute",
              left: x + 5,
              width: NOTE_WIDTH - 10,
              top: bodyBottom,
              height: bodyHeight,
              backgroundColor: color,
              opacity: 0.4,
              borderRadius: 2,
            }}
          />
        )}
        {/* Tail - small indicator at judgment line */}
        {timeUntilEnd < VISIBLE_TIME && timeUntilEnd > -200 && (
          <div
            style={{
              position: "absolute",
              left: x + NOTE_WIDTH / 2 - 6,
              top: tailY - 6,
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: `10px solid ${color}`,
              opacity: tailOpacity,
              filter: tailIsHit ? `drop-shadow(0 0 8px ${color})` : "none",
            }}
          />
        )}
      </>
    );
  }

  // === Regular note (not LN) ===
  const progress = 1 - timeUntilStart / VISIBLE_TIME;
  const y = interpolate(progress, [0, 1], [-NOTE_HEIGHT, JUDGMENT_LINE_Y]);

  const isHit = Math.abs(timeUntilStart) < 50;
  const opacity = isHit ? 1 : Math.min(1, progress * 1.5);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: NOTE_WIDTH,
        height: NOTE_HEIGHT,
        backgroundColor: color,
        borderRadius: 4,
        opacity,
        boxShadow: isHit ? `0 0 20px ${color}` : "none",
      }}
    >
      {/* Approach circle indicator */}
      {!isHit && (
        <div
          style={{
            position: "absolute",
            top: -20,
            left: "50%",
            transform: "translateX(-50%)",
            width: 30,
            height: 30,
            borderRadius: "50%",
            border: `2px solid ${color}`,
            opacity: Math.max(0, Math.min(1, 1 - progress)),
          }}
        />
      )}
    </div>
  );
};

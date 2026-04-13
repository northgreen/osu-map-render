import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { HitObject } from "./lib/osuParser";

interface ManiaNoteProps {
  note: HitObject;
  approachRate: number;
}

const COLUMN_POSITIONS = [120, 257, 385, 513];
const NOTE_WIDTH = 100;
const NOTE_HEIGHT = 40;
const JUDGMENT_LINE_Y = 900;

// Calculate visible time based on AR
function getVisibleTime(ar: number): number {
  if (ar < 5) {
    return 1200 + (5 - ar) * 120;
  } else if (ar > 5) {
    return 1200 - (ar - 5) * 120;
  }
  return 1200;
}

export const ManiaNote: React.FC<ManiaNoteProps> = ({ note, approachRate }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const VISIBLE_TIME = getVisibleTime(approachRate);
  const currentTime = (frame / fps) * 1000;

  const { isLongNote, endTime, time: startTime } = note;
  const timeUntilStart = startTime - currentTime;
  const timeUntilEnd = isLongNote && endTime ? endTime - currentTime : timeUntilStart;

  // Only render if note is within visible range
  if (timeUntilStart > VISIBLE_TIME || timeUntilEnd < -200) {
    return null;
  }

  // Column position
  const column = Math.min(note.column, 3);
  const x = COLUMN_POSITIONS[column] - NOTE_WIDTH / 2;

  // Note color based on column
  const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4"];
  const color = colors[column];

  // === Render Long Note body (if visible) ===
  if (isLongNote && endTime) {
    const headProgress = 1 - timeUntilStart / VISIBLE_TIME;
    const tailProgress = 1 - timeUntilEnd / VISIBLE_TIME;

    const headY = interpolate(headProgress, [0, 1], [-NOTE_HEIGHT, JUDGMENT_LINE_Y]);
    const tailY = interpolate(tailProgress, [0, 1], [-NOTE_HEIGHT, JUDGMENT_LINE_Y]);

    const headIsHit = Math.abs(timeUntilStart) < 50;
    const tailIsHit = Math.abs(timeUntilEnd) < 50;

    const headOpacity = headIsHit ? 1 : Math.min(1, headProgress * 1.5);
    const tailOpacity = tailIsHit ? 1 : Math.min(1, tailProgress * 1.5);

    return (
      <>
        {/* LN Body - connecting head and tail */}
        <div
          style={{
            position: "absolute",
            left: x + 10,
            width: NOTE_WIDTH - 20,
            top: tailY + NOTE_HEIGHT / 2,
            height: headY - tailY - NOTE_HEIGHT,
            backgroundColor: color,
            opacity: 0.5,
            borderRadius: 2,
          }}
        />
        {/* Head note */}
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
        {/* Tail - just the tip (small triangle indicator) */}
        {timeUntilEnd < VISIBLE_TIME && (
          <div
            style={{
              position: "absolute",
              left: x + NOTE_WIDTH / 2 - 8,
              top: tailY + NOTE_HEIGHT / 2 - 8,
              width: 0,
              height: 0,
              borderLeft: "8px solid transparent",
              borderRight: "8px solid transparent",
              borderTop: `12px solid ${color}`,
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

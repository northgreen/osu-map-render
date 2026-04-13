import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { HitObject } from "./lib/osuParser";

interface ManiaNoteProps {
  note: HitObject;
  approachRate: number;
}

const COLUMN_POSITIONS = [64, 192, 320, 448];
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
  const currentTime = (frame / fps) * 1000; // Convert to ms
  const timeUntilHit = note.time - currentTime;

  // Only render if note is within visible range
  if (timeUntilHit > VISIBLE_TIME || timeUntilHit < -200) {
    return null;
  }

  // Calculate Y position based on time until hit
  // Notes fall from top (y=0) to judgment line (y=JUDGMENT_LINE_Y)
  const progress = 1 - timeUntilHit / VISIBLE_TIME;
  const y = interpolate(progress, [0, 1], [-NOTE_HEIGHT, JUDGMENT_LINE_Y]);

  // Column position
  const column = Math.min(note.column, 3);
  const x = COLUMN_POSITIONS[column] - NOTE_WIDTH / 2;

  // Note color based on column
  const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4"];
  const color = colors[column];

  // Check if note is being hit (within 50ms of judgment line)
  const isHit = Math.abs(timeUntilHit) < 50;
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
        transition: "box-shadow 0.1s",
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
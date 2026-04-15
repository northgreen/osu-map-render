import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { HitObject } from "./lib/osuParser";
import {
  SCROLL_SPEED,
  BASE_VISIBLE_TIME,
  NOTE_WIDTH,
  NOTE_HEIGHT,
  JUDGMENT_LINE_Y,
  config,
} from "./config";

interface ManiaNoteProps {
  note: HitObject;
  scrollSpeed?: number;
  judgmentLineY?: number;
  stageOffset?: number;
}

// Calculate visible time based on scroll speed
function getVisibleTime(scrollSpeed: number): number {
  // scrollSpeed=10 → 1800ms, scrollSpeed=20 → 900ms, etc.
  return BASE_VISIBLE_TIME * (10 / scrollSpeed);
}

export const ManiaNote: React.FC<ManiaNoteProps> = ({
  note,
  scrollSpeed = SCROLL_SPEED,
  judgmentLineY: jy = JUDGMENT_LINE_Y,
  stageOffset = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const VISIBLE_TIME = getVisibleTime(scrollSpeed);
  const currentTime = (frame / fps) * 1000;

  const { isLongNote, endTime, time: startTime } = note;
  const timeUntilStart = startTime - currentTime;
  const timeUntilEnd = isLongNote && endTime ? endTime - currentTime : timeUntilStart;

  // Debug: log first few notes
  if (frame === 0 && note.time < 5000) {
    console.log(`Note time: ${startTime}, currentTime: ${currentTime}, until: ${timeUntilStart}, visible: ${VISIBLE_TIME}`);
  }

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
  const x = config.columnPositionsNote[column] - NOTE_WIDTH / 2 + stageOffset;

  // Note color based on column
  const color = config.columnColors[column];

  // === Render Long Note ===
  if (isLongNote && endTime) {
    const headProgress = 1 - timeUntilStart / VISIBLE_TIME;
    const tailProgress = 1 - timeUntilEnd / VISIBLE_TIME;

    // Clamp progress to valid range (0 = at top, 1 = at judgment line)
    const clampedHeadProgress = Math.max(0, Math.min(1, headProgress));
    const clampedTailProgress = Math.max(0, Math.min(1, tailProgress));

    // Head position: from top (-NOTE_HEIGHT) to judgment line
    const headY = interpolate(clampedHeadProgress, [0, 1], [-NOTE_HEIGHT, jy]);

    // Tail position: from top to judgment line
    const tailY = interpolate(clampedTailProgress, [0, 1], [-NOTE_HEIGHT, jy]);

    // Body: always connects head bottom to tail top
    // Only visible when both head and tail have appeared
    const bodyTop = headY + NOTE_HEIGHT;  // Bottom of head note
    const bodyBottom = tailY;             // Position of tail
    const bodyHeight = Math.abs(bodyTop - bodyBottom);

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
            border: "2px solid white", // Debug border
            opacity: headOpacity,
            boxShadow: headIsHit ? `0 0 20px ${color}` : "none",
          }}
        />
        {/* LN Body - connects head to tail */}
        {showBody && bodyHeight > 10 && (
          <div
            style={{
              position: "absolute",
              left: x + 5,
              width: NOTE_WIDTH - 10,
              top: Math.min(bodyTop, bodyBottom),
              height: bodyHeight - 10,
              backgroundColor: color,
              opacity: 0.4,
              borderRadius: 50,
            }}
          />
        )}
        {/* Tail - LN release indicator at judgment line */}
        {
        //   timeUntilEnd < VISIBLE_TIME && timeUntilEnd > -200 && (
        //   <div
        //     style={{
        //       position: "absolute",
        //       left: x + 5,
        //       top: tailY,
        //       width: NOTE_WIDTH - 10,
        //       height: 20,
        //       backgroundColor: color,
        //       clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
        //       opacity: 0.4,
        //       boxShadow: tailIsHit ? `0 0 15px ${color}` : `0 0 5px ${color}`,
        //     }}
        //   />
        // )
        }
      </>
    );
  }

  // === Regular note (not LN) ===
  // Hide note after it passes judgment line
  if (timeUntilStart < -50) {
    return null;
  }

  const progress = 1 - timeUntilStart / VISIBLE_TIME;
  const y = interpolate(progress, [0, 1], [-NOTE_HEIGHT, jy]);

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
        border: "2px solid white", // Debug border
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

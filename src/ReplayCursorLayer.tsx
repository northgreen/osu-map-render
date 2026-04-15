import { AbsoluteFill } from "remotion";
import { ReplayCursor } from "./ReplayCursor";
import { SCROLL_SPEED as DEFAULT_SCROLL_SPEED, JUDGMENT_LINE_Y } from "./config";

interface ReplayCursorLayerProps {
  scrollSpeed?: number;
  stageOffset?: number;
  judgmentLineY?: number;
}

export const ReplayCursorLayer: React.FC<ReplayCursorLayerProps> = ({
  scrollSpeed = DEFAULT_SCROLL_SPEED,
  stageOffset = 0,
  judgmentLineY = JUDGMENT_LINE_Y,
}) => {
  console.log("ReplayCursorLayer props:", { scrollSpeed, stageOffset, judgmentLineY });
  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      <ReplayCursor
        scrollSpeed={scrollSpeed}
        stageOffset={stageOffset}
        judgmentLineY={judgmentLineY}
      />
    </AbsoluteFill>
  );
};

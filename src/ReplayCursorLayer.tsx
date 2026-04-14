import { AbsoluteFill } from "remotion";
import { ReplayCursor } from "./ReplayCursor";
import { SCROLL_SPEED as DEFAULT_SCROLL_SPEED } from "./config";

interface ReplayCursorLayerProps {
  scrollSpeed?: number;
}

export const ReplayCursorLayer: React.FC<ReplayCursorLayerProps> = ({
  scrollSpeed = DEFAULT_SCROLL_SPEED,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      <ReplayCursor scrollSpeed={scrollSpeed} />
    </AbsoluteFill>
  );
};
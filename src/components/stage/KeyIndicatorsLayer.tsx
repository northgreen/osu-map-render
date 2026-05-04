import { config } from "../../config";

// ============================================
// KeyIndicatorsLayer
// ============================================

/** Props for the key press indicator layer */
export interface KeyIndicatorsLayerProps {
  /** Whether each column key is currently pressed */
  pressedKeys: boolean[];
  /** Y position of the judgment line in pixels */
  judgmentY: number;
  /** Left edge of the stage in pixels */
  stageX: number;
}

/** Keyboard labels mapped to column index for osu!mania default keybinds */
const KEY_LABELS = [
  "D", "F", "J", "K", "A", "S", "Z", "X", "C",
  "V", "B", "N", "M", ",", ".", "/", "'", ";", "L",
];

/**
 * Render key press indicator boxes at the bottom of the stage.
 * Active indicators are filled with the column color and glow.
 */
export const KeyIndicatorsLayer: React.FC<KeyIndicatorsLayerProps> = ({
  pressedKeys,
  judgmentY,
  stageX,
}) => {
  return (
    <>
      {config.columnPositionsStage.map((pos, i) => {
        const isPressed = pressedKeys[i];
        return (
          <div
            key={`key-${i}`}
            className={`key-indicator ${isPressed ? "pressed" : ""}`}
            style={{
              left: stageX + pos - config.columnWidth / 2,
              top: judgmentY + 10,
              width: config.columnWidth,
              backgroundColor: isPressed ? config.columnColors[i] : undefined,
              borderColor: isPressed ? config.columnColors[i] : undefined,
              boxShadow: isPressed
                ? `0 0 20px ${config.columnColors[i]}`
                : undefined,
            }}
          >
            {KEY_LABELS[i] ?? i}
          </div>
        );
      })}
    </>
  );
};

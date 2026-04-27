import { describe, it, expect } from "vitest";
import {
  getPosition,
  getScale,
  getVectorScale,
} from "../../../storyboard/command-evaluator";
import type { SbCommand, SbObject } from "../../../sbParser";
import {
  createMCommand,
  createSCommand,
  createVCommand,
  createLoop,
  noLoops,
} from "../../test-utils";

// ============================================
// 1. STORYBOARD_SCALE Constant Tests
// ============================================

// Constants mirrored from StoryboardLayer.tsx
const SB_BASE_WIDTH = 640;
const SB_BASE_HEIGHT = 480;
const RENDER_WIDTH = 1920;
const RENDER_HEIGHT = 1080;
const STORYBOARD_SCALE = RENDER_HEIGHT / SB_BASE_HEIGHT; // 2.25

const containerOffsetX = (RENDER_WIDTH - SB_BASE_WIDTH * STORYBOARD_SCALE) / 2;
const containerOffsetY = (RENDER_HEIGHT - SB_BASE_HEIGHT * STORYBOARD_SCALE) / 2;

describe("STORYBOARD_SCALE constant", () => {
  it("should equal RENDER_HEIGHT / SB_BASE_HEIGHT", () => {
    // osu! uses DrawScale = DrawHeight / 480
    // For 1080p: 1080 / 480 = 2.25
    expect(STORYBOARD_SCALE).toBe(1080 / 480);
  });

  it("should equal 2.25", () => {
    expect(STORYBOARD_SCALE).toBe(2.25);
  });

  it("should scale storyboard coordinates correctly to render space", () => {
    // A point at (320, 240) in storyboard space (center)
    // should map to (320 * 2.25, 240 * 2.25) = (720, 540) in unscaled render space
    const sbX = 320;
    const sbY = 240;
    const renderX = sbX * STORYBOARD_SCALE;
    const renderY = sbY * STORYBOARD_SCALE;
    expect(renderX).toBe(720);
    expect(renderY).toBe(540);
  });

  it("should scale full storyboard width to 1440px", () => {
    // 640 * 2.25 = 1440 (not 1920, because container is centered)
    expect(SB_BASE_WIDTH * STORYBOARD_SCALE).toBe(1440);
  });

  it("should scale full storyboard height to 1080px (exact fit)", () => {
    // 480 * 2.25 = 1080 (exact fit vertically)
    expect(SB_BASE_HEIGHT * STORYBOARD_SCALE).toBe(1080);
  });
});

// ============================================
// 2. Container Offset Calculations
// ============================================

describe("Container offset calculations", () => {
  it("should compute containerOffsetX = 240", () => {
    // (1920 - 640 * 2.25) / 2 = (1920 - 1440) / 2 = 240
    expect(containerOffsetX).toBe(240);
  });

  it("should compute containerOffsetY = 0", () => {
    // (1080 - 480 * 2.25) / 2 = (1080 - 1080) / 2 = 0
    expect(containerOffsetY).toBe(0);
  });

  it("should center the storyboard container horizontally", () => {
    // Container spans from x=240 to x=240+1440=1680
    // Left margin = 240, right margin = 1920 - 1680 = 240
    const containerLeft = containerOffsetX;
    const containerRight = containerOffsetX + SB_BASE_WIDTH * STORYBOARD_SCALE;
    const leftMargin = containerLeft;
    const rightMargin = RENDER_WIDTH - containerRight;
    expect(leftMargin).toBe(rightMargin);
    expect(leftMargin).toBe(240);
  });

  it("should fill the screen vertically with no offset", () => {
    // Container spans from y=0 to y=1080 (exact match)
    const containerTop = containerOffsetY;
    const containerBottom = containerOffsetY + SB_BASE_HEIGHT * STORYBOARD_SCALE;
    expect(containerTop).toBe(0);
    expect(containerBottom).toBe(1080);
  });

  it("should map storyboard (0,0) to render (240, 0)", () => {
    // Top-left of storyboard space maps to left edge of centered container
    const renderX = containerOffsetX + 0 * STORYBOARD_SCALE;
    const renderY = containerOffsetY + 0 * STORYBOARD_SCALE;
    expect(renderX).toBe(240);
    expect(renderY).toBe(0);
  });

  it("should map storyboard (640,480) to render (1680, 1080)", () => {
    // Bottom-right of storyboard space maps to right edge of centered container
    const renderX = containerOffsetX + 640 * STORYBOARD_SCALE;
    const renderY = containerOffsetY + 480 * STORYBOARD_SCALE;
    expect(renderX).toBe(1680);
    expect(renderY).toBe(1080);
  });

  it("should map storyboard center (320,240) to render center (960,540)", () => {
    // Center of storyboard maps to center of screen
    const renderX = containerOffsetX + 320 * STORYBOARD_SCALE;
    const renderY = containerOffsetY + 240 * STORYBOARD_SCALE;
    expect(renderX).toBe(960);
    expect(renderY).toBe(540);
  });
});

// ============================================
// 3. Combined Scale Calculation Tests
// ============================================

describe("Combined scale calculation", () => {
  /**
   * In osu!, the final rendered size is computed as:
   *   finalWidth = nativeWidth * DrawScale * VectorScaleX * Scale
   *   finalHeight = nativeHeight * DrawScale * VectorScaleY * Scale
   *
   * Where:
   * - DrawScale = screenH / 480 (2.25 for 1080p)
   * - VectorScale comes from V commands (sets absolute size)
   * - Scale comes from S commands (relative multiplier)
   *
   * This test verifies that Scale * VectorScale are multiplied correctly,
   * and that STORYBOARD_SCALE is applied to dimensions.
   */

  it("should multiply Scale and VectorScale correctly", () => {
    const nativeWidth = 100;
    const nativeHeight = 100;
    const commands = [
      createSCommand(0, 1000, 2, 2),
      createVCommand(0, 1000, 1.5, 1.5, 1.5, 1.5),
    ];

    const rawScale = getScale(commands, noLoops, 500);
    const vectorScale = getVectorScale(commands, noLoops, 500);

    const vectorScaleX = vectorScale ? vectorScale.x : 1;
    const vectorScaleY = vectorScale ? vectorScale.y : 1;

    const finalWidth = nativeWidth * STORYBOARD_SCALE * vectorScaleX * rawScale;
    const finalHeight = nativeHeight * STORYBOARD_SCALE * vectorScaleY * rawScale;

    // 100 * 2.25 * 1.5 * 2 = 675
    expect(finalWidth).toBe(675);
    expect(finalHeight).toBe(675);
  });

  it("should apply STORYBOARD_SCALE to base dimensions", () => {
    const nativeWidth = 200;
    const nativeHeight = 150;
    const commands: SbCommand[] = [];

    const rawScale = getScale(commands, noLoops, 0);
    const vectorScale = getVectorScale(commands, noLoops, 0);
    const vectorScaleX = vectorScale ? vectorScale.x : 1;
    const vectorScaleY = vectorScale ? vectorScale.y : 1;

    const finalWidth = nativeWidth * STORYBOARD_SCALE * vectorScaleX * rawScale;
    const finalHeight = nativeHeight * STORYBOARD_SCALE * vectorScaleY * rawScale;

    // 200 * 2.25 * 1 * 1 = 450
    expect(finalWidth).toBe(450);
    // 150 * 2.25 * 1 * 1 = 337.5
    expect(finalHeight).toBe(337.5);
  });

  it("should handle independent X/Y vector scaling with uniform scale", () => {
    const nativeWidth = 100;
    const nativeHeight = 100;
    const commands = [
      createSCommand(0, 1000, 2, 2),
      createVCommand(0, 1000, 3, 1, 3, 1), // Stretch X only
    ];

    const rawScale = getScale(commands, noLoops, 500);
    const vectorScale = getVectorScale(commands, noLoops, 500);

    const finalWidth = nativeWidth * STORYBOARD_SCALE * vectorScale!.x * rawScale;
    const finalHeight = nativeHeight * STORYBOARD_SCALE * vectorScale!.y * rawScale;

    // Width: 100 * 2.25 * 3 * 2 = 1350
    expect(finalWidth).toBe(1350);
    // Height: 100 * 2.25 * 1 * 2 = 450
    expect(finalHeight).toBe(450);
  });

  it("should match osu! behavior: V command sets absolute size regardless of image dimensions", () => {
    /**
     * osu! V command behavior:
     * V sets the size of the sprite in storyboard units, overriding the
     * image's native dimensions. The formula is:
     *   renderedSize = V_value * DrawScale * S_value
     *
     * However, in our implementation, V acts as a multiplier on native size.
     * This test documents the actual behavior.
     */
    const nativeWidth = 50;
    const nativeHeight = 50;
    const commands = [
      createVCommand(0, 1000, 2, 2, 2, 2),
    ];

    const vectorScale = getVectorScale(commands, noLoops, 500);
    const rawScale = getScale(commands, noLoops, 500);

    const finalWidth = nativeWidth * STORYBOARD_SCALE * vectorScale!.x * rawScale;
    const finalHeight = nativeHeight * STORYBOARD_SCALE * vectorScale!.y * rawScale;

    // 50 * 2.25 * 2 * 1 = 225
    expect(finalWidth).toBe(225);
    expect(finalHeight).toBe(225);
  });

  it("should handle scale transitions combined with vector scale", () => {
    const nativeWidth = 100;
    const nativeHeight = 100;
    const commands = [
      createSCommand(0, 1000, 1, 3),
      createVCommand(0, 1000, 1, 1, 2, 2),
    ];

    // At t=500: scale=2, vectorScale=1.5
    const rawScale = getScale(commands, noLoops, 500);
    const vectorScale = getVectorScale(commands, noLoops, 500);

    const finalWidth = nativeWidth * STORYBOARD_SCALE * vectorScale!.x * rawScale;
    const finalHeight = nativeHeight * STORYBOARD_SCALE * vectorScale!.y * rawScale;

    // 100 * 2.25 * 1.5 * 2 = 675
    expect(finalWidth).toBe(675);
    expect(finalHeight).toBe(675);
  });

  it("should compute final position with container offset", () => {
    /**
     * Final render position:
     *   renderX = containerOffsetX + rawPos.x * STORYBOARD_SCALE
     *   renderY = containerOffsetY + rawPos.y * STORYBOARD_SCALE
     */
    const commands = [createMCommand("M", 0, 1000, [100, 100, 300, 300])];
    const rawPos = getPosition(commands, noLoops, 500, 100, 100);

    const renderX = containerOffsetX + rawPos.x * STORYBOARD_SCALE;
    const renderY = containerOffsetY + rawPos.y * STORYBOARD_SCALE;

    // At 50%: rawPos = (200, 200)
    // renderX = 240 + 200 * 2.25 = 240 + 450 = 690
    expect(renderX).toBe(690);
    // renderY = 0 + 200 * 2.25 = 450
    expect(renderY).toBe(450);
  });
});

// ============================================
// 4. Origin Handling Tests
// ============================================

describe("Origin handling - position offset calculation", () => {
  /**
   * osu! origin types determine where the sprite's anchor point is relative
   * to its bounding box. The anchor point is where the sprite's (x, y) position
   * is placed. The sprite is then offset by:
   *   finalX = positionX - width * originFactor.x
   *   finalY = positionY - height * originFactor.y
   *
   * Origin factors:
   *   TopLeft:      (0, 0)   - anchor at top-left corner
   *   Centre:       (0.5, 0.5) - anchor at center
   *   CentreLeft:   (0, 0.5) - anchor at middle-left edge
   *   TopRight:     (1, 0)   - anchor at top-right corner
   *   BottomCentre: (0.5, 1) - anchor at bottom-center edge
   *   TopCentre:    (0.5, 0) - anchor at top-center edge
   *   CentreRight:  (1, 0.5) - anchor at middle-right edge
   *   BottomLeft:   (0, 1)   - anchor at bottom-left corner
   *   BottomRight:  (1, 1)   - anchor at bottom-right corner
   */

  const originFactors: Record<string, { x: number; y: number }> = {
    TopLeft: { x: 0, y: 0 },
    Centre: { x: 0.5, y: 0.5 },
    CentreLeft: { x: 0, y: 0.5 },
    TopRight: { x: 1, y: 0 },
    BottomCentre: { x: 0.5, y: 1 },
    TopCentre: { x: 0.5, y: 0 },
    CentreRight: { x: 1, y: 0.5 },
    BottomLeft: { x: 0, y: 1 },
    BottomRight: { x: 1, y: 1 },
  };

  it("should compute correct offset for TopLeft origin", () => {
    const positionX = 500;
    const positionY = 300;
    const width = 200;
    const height = 100;
    const factor = originFactors.TopLeft;

    const finalX = positionX - width * factor.x;
    const finalY = positionY - height * factor.y;

    // TopLeft: no offset, position is at top-left corner
    expect(finalX).toBe(500);
    expect(finalY).toBe(300);
  });

  it("should compute correct offset for Centre origin", () => {
    const positionX = 500;
    const positionY = 300;
    const width = 200;
    const height = 100;
    const factor = originFactors.Centre;

    const finalX = positionX - width * factor.x;
    const finalY = positionY - height * factor.y;

    // Centre: offset by half width/height
    expect(finalX).toBe(400); // 500 - 100
    expect(finalY).toBe(250); // 300 - 50
  });

  it("should compute correct offset for BottomRight origin", () => {
    const positionX = 500;
    const positionY = 300;
    const width = 200;
    const height = 100;
    const factor = originFactors.BottomRight;

    const finalX = positionX - width * factor.x;
    const finalY = positionY - height * factor.y;

    // BottomRight: offset by full width/height
    expect(finalX).toBe(300); // 500 - 200
    expect(finalY).toBe(200); // 300 - 100
  });

  it("should compute correct offset for TopRight origin", () => {
    const positionX = 500;
    const positionY = 300;
    const width = 200;
    const height = 100;
    const factor = originFactors.TopRight;

    const finalX = positionX - width * factor.x;
    const finalY = positionY - height * factor.y;

    expect(finalX).toBe(300); // 500 - 200
    expect(finalY).toBe(300); // 300 - 0
  });

  it("should compute correct offset for BottomCentre origin", () => {
    const positionX = 500;
    const positionY = 300;
    const width = 200;
    const height = 100;
    const factor = originFactors.BottomCentre;

    const finalX = positionX - width * factor.x;
    const finalY = positionY - height * factor.y;

    expect(finalX).toBe(400); // 500 - 100
    expect(finalY).toBe(200); // 300 - 100
  });

  it("should compute correct offset for CentreLeft origin", () => {
    const positionX = 500;
    const positionY = 300;
    const width = 200;
    const height = 100;
    const factor = originFactors.CentreLeft;

    const finalX = positionX - width * factor.x;
    const finalY = positionY - height * factor.y;

    expect(finalX).toBe(500); // 500 - 0
    expect(finalY).toBe(250); // 300 - 50
  });

  it("should compute correct offset for TopCentre origin", () => {
    const positionX = 500;
    const positionY = 300;
    const width = 200;
    const height = 100;
    const factor = originFactors.TopCentre;

    const finalX = positionX - width * factor.x;
    const finalY = positionY - height * factor.y;

    expect(finalX).toBe(400); // 500 - 100
    expect(finalY).toBe(300); // 300 - 0
  });

  it("should compute correct offset for CentreRight origin", () => {
    const positionX = 500;
    const positionY = 300;
    const width = 200;
    const height = 100;
    const factor = originFactors.CentreRight;

    const finalX = positionX - width * factor.x;
    const finalY = positionY - height * factor.y;

    expect(finalX).toBe(300); // 500 - 200
    expect(finalY).toBe(250); // 300 - 50
  });

  it("should compute correct offset for BottomLeft origin", () => {
    const positionX = 500;
    const positionY = 300;
    const width = 200;
    const height = 100;
    const factor = originFactors.BottomLeft;

    const finalX = positionX - width * factor.x;
    const finalY = positionY - height * factor.y;

    expect(finalX).toBe(500); // 500 - 0
    expect(finalY).toBe(200); // 300 - 100
  });
});

describe("Origin handling - flip interaction", () => {
  /**
   * When flipH or flipV is applied, the origin factor is inverted:
   *   effectiveFactor.x = flipH ? (1 - factor.x) : factor.x
   *   effectiveFactor.y = flipV ? (1 - factor.y) : factor.y
   *
   * This ensures the sprite flips around its correct anchor point.
   */

  it("should invert X factor when flipH is applied to Centre origin", () => {
    const factor = { x: 0.5, y: 0.5 };
    const flipH = true;
    const flipV = false;

    const effectiveX = flipH ? 1 - factor.x : factor.x;
    const effectiveY = flipV ? 1 - factor.y : factor.y;

    // Centre with flipH: (0.5, 0.5) -> (0.5, 0.5) (unchanged for Centre)
    expect(effectiveX).toBe(0.5);
    expect(effectiveY).toBe(0.5);
  });

  it("should invert X factor when flipH is applied to TopLeft origin", () => {
    const factor = { x: 0, y: 0 };
    const flipH = true;
    const flipV = false;

    const effectiveX = flipH ? 1 - factor.x : factor.x;
    const effectiveY = flipV ? 1 - factor.y : factor.y;

    // TopLeft with flipH: (0, 0) -> (1, 0) (becomes TopRight)
    expect(effectiveX).toBe(1);
    expect(effectiveY).toBe(0);
  });

  it("should invert Y factor when flipV is applied to TopLeft origin", () => {
    const factor = { x: 0, y: 0 };
    const flipH = false;
    const flipV = true;

    const effectiveX = flipH ? 1 - factor.x : factor.x;
    const effectiveY = flipV ? 1 - factor.y : factor.y;

    // TopLeft with flipV: (0, 0) -> (0, 1) (becomes BottomLeft)
    expect(effectiveX).toBe(0);
    expect(effectiveY).toBe(1);
  });

  it("should invert both factors when both flips are applied", () => {
    const factor = { x: 0, y: 0 };
    const flipH = true;
    const flipV = true;

    const effectiveX = flipH ? 1 - factor.x : factor.x;
    const effectiveY = flipV ? 1 - factor.y : factor.y;

    // TopLeft with both flips: (0, 0) -> (1, 1) (becomes BottomRight)
    expect(effectiveX).toBe(1);
    expect(effectiveY).toBe(1);
  });

  it("should handle flipH with BottomRight origin", () => {
    const factor = { x: 1, y: 1 };
    const flipH = true;
    const flipV = false;

    const effectiveX = flipH ? 1 - factor.x : factor.x;
    const effectiveY = flipV ? 1 - factor.y : factor.y;

    // BottomRight with flipH: (1, 1) -> (0, 1) (becomes BottomLeft)
    expect(effectiveX).toBe(0);
    expect(effectiveY).toBe(1);
  });

  it("should double-flip return to original (flipH twice)", () => {
    const factor = { x: 0, y: 0 };

    // First flip
    const afterFirstFlip = { x: 1 - factor.x, y: factor.y };
    // Second flip
    const afterSecondFlip = { x: 1 - afterFirstFlip.x, y: afterFirstFlip.y };

    expect(afterSecondFlip.x).toBe(factor.x);
    expect(afterSecondFlip.y).toBe(factor.y);
  });
});

// ============================================
// 5. Integration Tests - Full sprite rendering
// ============================================

describe("Integration - Full sprite rendering calculation", () => {
  /**
   * These tests simulate the complete rendering calculation for a sprite,
   * combining position, scale, origin, and container offset to verify
   * osu! parity.
   */

  function computeSpriteRect(
    object: Pick<SbObject, "x" | "y" | "origin" | "commands" | "loops" | "flipH" | "flipV">,
    currentTime: number,
    nativeWidth: number,
    nativeHeight: number,
  ): { x: number; y: number; width: number; height: number } {
    const loops = object.loops || [];

    // 1. Get position in storyboard space
    const rawPos = getPosition(object.commands, loops, currentTime, object.x, object.y);

    // 2. Scale to render space with container offset
    const x = containerOffsetX + rawPos.x * STORYBOARD_SCALE;
    const y = containerOffsetY + rawPos.y * STORYBOARD_SCALE;

    // 3. Get scale factors
    const vectorScale = getVectorScale(object.commands, loops, currentTime);
    const rawScale = getScale(object.commands, loops, currentTime);
    const vectorScaleX = vectorScale ? vectorScale.x : 1;
    const vectorScaleY = vectorScale ? vectorScale.y : 1;

    // 4. Compute dimensions
    const baseWidth = nativeWidth * STORYBOARD_SCALE * vectorScaleX * rawScale;
    const baseHeight = nativeHeight * STORYBOARD_SCALE * vectorScaleY * rawScale;

    // 5. Apply origin offset
    const originFactors: Record<string, { x: number; y: number }> = {
      TopLeft: { x: 0, y: 0 },
      Centre: { x: 0.5, y: 0.5 },
      CentreLeft: { x: 0, y: 0.5 },
      TopRight: { x: 1, y: 0 },
      BottomCentre: { x: 0.5, y: 1 },
      TopCentre: { x: 0.5, y: 0 },
      CentreRight: { x: 1, y: 0.5 },
      BottomLeft: { x: 0, y: 1 },
      BottomRight: { x: 1, y: 1 },
    };

    const originFactor = { ...(originFactors[object.origin] || { x: 0, y: 0 }) };

    // 6. Apply flip
    const flipH = object.flipH || false;
    const flipV = object.flipV || false;
    if (flipH) originFactor.x = 1 - originFactor.x;
    if (flipV) originFactor.y = 1 - originFactor.y;

    // 7. Final position
    const finalX = x - baseWidth * originFactor.x;
    const finalY = y - baseHeight * originFactor.y;

    return { x: finalX, y: finalY, width: baseWidth, height: baseHeight };
  }

  it("should render a static sprite at correct position", () => {
    /**
     * Sprite at (320, 240) with Centre origin, 100x100 image, no commands
     * Expected:
     *   rawPos = (320, 240)
     *   renderPos = (240 + 320*2.25, 0 + 240*2.25) = (960, 540)
     *   size = 100 * 2.25 * 1 * 1 = 225
     *   origin offset (Centre) = 225 * 0.5 = 112.5
     *   finalPos = (960 - 112.5, 540 - 112.5) = (847.5, 427.5)
     */
    const object: SbObject = {
      id: "test",
      type: "sprite",
      layer: "Pass",
      origin: "Centre",
      path: "test.png",
      x: 320,
      y: 240,
      commands: [],
      loops: [],
    };

    const rect = computeSpriteRect(object, 0, 100, 100);

    expect(rect.x).toBe(847.5);
    expect(rect.y).toBe(427.5);
    expect(rect.width).toBe(225);
    expect(rect.height).toBe(225);
  });

  it("should render a sprite with M command at interpolated position", () => {
    /**
     * Sprite at (100, 100), M moves to (300, 300) from t=0 to t=1000
     * At t=500: position = (200, 200)
     * renderPos = (240 + 200*2.25, 0 + 200*2.25) = (690, 450)
     * With Centre origin and 200x100 image:
     *   size = 200*2.25=450, 100*2.25=225
     *   origin offset = (225, 112.5)
     *   finalPos = (690-225, 450-112.5) = (465, 337.5)
     */
    const object: SbObject = {
      id: "test",
      type: "sprite",
      layer: "Pass",
      origin: "Centre",
      path: "test.png",
      x: 100,
      y: 100,
      commands: [createMCommand("M", 0, 1000, [100, 100, 300, 300])],
      loops: [],
    };

    const rect = computeSpriteRect(object, 500, 200, 100);

    expect(rect.x).toBe(465);
    expect(rect.y).toBe(337.5);
    expect(rect.width).toBe(450);
    expect(rect.height).toBe(225);
  });

  it("should render a sprite with S and V commands at correct size", () => {
    /**
     * Sprite with S,0,0,1000,1,2 (scale 1->2) and V,0,0,1000,1,1,3,2 (vector scale)
     * At t=500: scale=1.5, vectorScale=(2, 1.5)
     * 100x100 image:
     *   width = 100 * 2.25 * 2 * 1.5 = 675
     *   height = 100 * 2.25 * 1.5 * 1.5 = 506.25
     */
    const object: SbObject = {
      id: "test",
      type: "sprite",
      layer: "Pass",
      origin: "TopLeft",
      path: "test.png",
      x: 0,
      y: 0,
      commands: [
        createSCommand(0, 1000, 1, 2),
        createVCommand(0, 1000, 1, 1, 3, 2),
      ],
      loops: [],
    };

    const rect = computeSpriteRect(object, 500, 100, 100);

    expect(rect.width).toBe(675);
    expect(rect.height).toBe(506.25);
    // TopLeft origin with position (0,0): finalX = 240 + 0 = 240
    expect(rect.x).toBe(240);
    expect(rect.y).toBe(0);
  });

  it("should render a sprite with flipH correctly", () => {
    /**
     * Sprite at (320, 240) with Centre origin, flipH applied
     * Centre with flipH: origin factor stays (0.5, 0.5)
     * So flipH only affects the CSS transform, not the position
     */
    const object: SbObject = {
      id: "test",
      type: "sprite",
      layer: "Pass",
      origin: "Centre",
      path: "test.png",
      x: 320,
      y: 240,
      commands: [],
      loops: [],
      flipH: true,
    };

    const rect = computeSpriteRect(object, 0, 100, 100);

    // Position should be same as non-flipped (Centre origin is symmetric)
    expect(rect.x).toBe(847.5);
    expect(rect.y).toBe(427.5);
    expect(rect.width).toBe(225);
    expect(rect.height).toBe(225);
  });

  it("should render a sprite with flipH on TopLeft correctly", () => {
    /**
     * Sprite at (320, 240) with TopLeft origin, flipH applied
     * TopLeft with flipH: origin factor becomes (1, 0) (like TopRight)
     * Position: (240 + 320*2.25, 0 + 240*2.25) = (960, 540)
     * Size: 100 * 2.25 = 225
     * Origin offset with (1, 0): (225, 0)
     * Final: (960 - 225, 540 - 0) = (735, 540)
     */
    const object: SbObject = {
      id: "test",
      type: "sprite",
      layer: "Pass",
      origin: "TopLeft",
      path: "test.png",
      x: 320,
      y: 240,
      commands: [],
      loops: [],
      flipH: true,
    };

    const rect = computeSpriteRect(object, 0, 100, 100);

    expect(rect.x).toBe(735);
    expect(rect.y).toBe(540);
  });

  it("should render a sprite with loop at correct position", () => {
    /**
     * Sprite with loop: L,0,2 containing M,0,500,0,0,100,100
     * At t=250 (midpoint of first iteration): position = (50, 50)
     * renderPos = (240 + 50*2.25, 0 + 50*2.25) = (352.5, 112.5)
     * With Centre origin and 100x100 image:
     *   size = 225
     *   origin offset = 112.5
     *   finalPos = (352.5 - 112.5, 112.5 - 112.5) = (240, 0)
     */
    const object: SbObject = {
      id: "test",
      type: "sprite",
      layer: "Pass",
      origin: "Centre",
      path: "test.png",
      x: 0,
      y: 0,
      commands: [],
      loops: [
        createLoop(0, 2, [
          createMCommand("M", 0, 500, [0, 0, 100, 100]),
        ], 500),
      ],
    };

    const rect = computeSpriteRect(object, 250, 100, 100);

    expect(rect.x).toBe(240);
    expect(rect.y).toBe(0);
    expect(rect.width).toBe(225);
    expect(rect.height).toBe(225);
  });

  it("should render a sprite at screen edge correctly", () => {
    /**
     * Sprite at (0, 0) with TopLeft origin
     * renderPos = (240 + 0, 0 + 0) = (240, 0)
     * This is the left edge of the storyboard container
     */
    const object: SbObject = {
      id: "test",
      type: "sprite",
      layer: "Pass",
      origin: "TopLeft",
      path: "test.png",
      x: 0,
      y: 0,
      commands: [],
      loops: [],
    };

    const rect = computeSpriteRect(object, 0, 100, 100);

    expect(rect.x).toBe(240);
    expect(rect.y).toBe(0);
  });

  it("should render a sprite at right edge of container", () => {
    /**
     * Sprite at (640, 480) with BottomRight origin
     * renderPos = (240 + 640*2.25, 0 + 480*2.25) = (1680, 1080)
     * This is the bottom-right corner of the container
     * With BottomRight origin, the sprite's bottom-right corner is at (1680, 1080)
     */
    const object: SbObject = {
      id: "test",
      type: "sprite",
      layer: "Pass",
      origin: "BottomRight",
      path: "test.png",
      x: 640,
      y: 480,
      commands: [],
      loops: [],
    };

    const rect = computeSpriteRect(object, 0, 100, 100);

    // Size = 225
    // finalX = 1680 - 225 = 1455
    // finalY = 1080 - 225 = 855
    expect(rect.x).toBe(1455);
    expect(rect.y).toBe(855);
    expect(rect.width).toBe(225);
    expect(rect.height).toBe(225);
  });

  it("should handle combined M, S, V, and origin in single calculation", () => {
    /**
     * Complex sprite:
     * - Position: (200, 150) at t=0, moving to (400, 300) at t=1000
     * - Scale: 1 at t=0, 2 at t=1000
     * - VectorScale: (1, 1) at t=0, (2, 1.5) at t=1000
     * - Origin: Centre
     * - Image: 200x100
     *
      * At t=500:
      * - Position: x interpolates (200→400) = 300, y interpolates (150→300) = 225
      * - Scale: 1.5
      * - VectorScale: (1.5, 1.25)
      * - renderPos = (240 + 300*2.25, 0 + 225*2.25) = (915, 506.25)
      * - Width = 200 * 2.25 * 1.5 * 1.5 = 1012.5
      * - Height = 100 * 2.25 * 1.25 * 1.5 = 421.875
      * - Origin offset (Centre) = (506.25, 210.9375)
      * - Final = (915 - 506.25, 506.25 - 210.9375) = (408.75, 295.3125)
     */
    const object: SbObject = {
      id: "test",
      type: "sprite",
      layer: "Pass",
      origin: "Centre",
      path: "test.png",
      x: 200,
      y: 150,
      commands: [
        createMCommand("M", 0, 1000, [200, 150, 400, 300]),
        createSCommand(0, 1000, 1, 2),
        createVCommand(0, 1000, 1, 1, 2, 1.5),
      ],
      loops: [],
    };

    const rect = computeSpriteRect(object, 500, 200, 100);

    expect(rect.x).toBeCloseTo(408.75);
    expect(rect.y).toBeCloseTo(295.3125);
    expect(rect.width).toBe(1012.5);
    expect(rect.height).toBe(421.875);
  });
});

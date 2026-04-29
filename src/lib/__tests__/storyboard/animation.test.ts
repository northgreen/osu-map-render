import { describe, it, expect } from "vitest";

// ============================================
// Frame calculation logic extracted from StoryboardLayer.tsx
// ============================================

function calculateFrameIndex(
  elapsed: number,
  frameCount: number,
  frameDelay: number,
  loopType: "LoopForever" | "LoopOnce",
): number {
  const totalDuration = frameCount * frameDelay;
  if (loopType === "LoopOnce") {
    return elapsed >= totalDuration
      ? frameCount - 1
      : Math.floor(elapsed / frameDelay) % frameCount;
  } else {
    return Math.floor((elapsed % totalDuration) / frameDelay) % frameCount;
  }
}

function getFramePath(path: string, frameIndex: number): string {
  const lastDotIndex = path.lastIndexOf(".");
  if (lastDotIndex !== -1) {
    return path.slice(0, lastDotIndex) + frameIndex + path.slice(lastDotIndex);
  }
  return path;
}

// ============================================
// LoopForever Tests
// ============================================

describe("Animation frame calculation - LoopForever", () => {
  it("should return frame 0 at elapsed=0", () => {
    const frame = calculateFrameIndex(0, 4, 100, "LoopForever");
    expect(frame).toBe(0);
  });

  it("should advance frame at each frameDelay", () => {
    const frameCount = 4;
    const frameDelay = 100;

    expect(calculateFrameIndex(0, frameCount, frameDelay, "LoopForever")).toBe(0);
    expect(calculateFrameIndex(99, frameCount, frameDelay, "LoopForever")).toBe(0);
    expect(calculateFrameIndex(100, frameCount, frameDelay, "LoopForever")).toBe(1);
    expect(calculateFrameIndex(199, frameCount, frameDelay, "LoopForever")).toBe(1);
    expect(calculateFrameIndex(200, frameCount, frameDelay, "LoopForever")).toBe(2);
    expect(calculateFrameIndex(299, frameCount, frameDelay, "LoopForever")).toBe(2);
    expect(calculateFrameIndex(300, frameCount, frameDelay, "LoopForever")).toBe(3);
  });

  it("should wrap to frame 0 after last frame", () => {
    const frameCount = 4;
    const frameDelay = 100;

    // At totalDuration, should wrap to frame 0
    expect(calculateFrameIndex(frameCount * frameDelay, frameCount, frameDelay, "LoopForever")).toBe(0);
    expect(calculateFrameIndex(frameCount * frameDelay + 1, frameCount, frameDelay, "LoopForever")).toBe(0);
    expect(calculateFrameIndex(frameCount * frameDelay + 100, frameCount, frameDelay, "LoopForever")).toBe(1);
  });

  it("should handle large elapsed times with modulo", () => {
    const frameCount = 4;
    const frameDelay = 100;

    // After 10 full loops (4000ms), should be back at frame 0
    expect(calculateFrameIndex(4000, frameCount, frameDelay, "LoopForever")).toBe(0);
    expect(calculateFrameIndex(4100, frameCount, frameDelay, "LoopForever")).toBe(1);

    // After 100 full loops (40000ms)
    expect(calculateFrameIndex(40000, frameCount, frameDelay, "LoopForever")).toBe(0);
    expect(calculateFrameIndex(40250, frameCount, frameDelay, "LoopForever")).toBe(2);
  });

  it("should handle single-frame animation", () => {
    expect(calculateFrameIndex(0, 1, 100, "LoopForever")).toBe(0);
    expect(calculateFrameIndex(99, 1, 100, "LoopForever")).toBe(0);
    expect(calculateFrameIndex(100, 1, 100, "LoopForever")).toBe(0);
    expect(calculateFrameIndex(999, 1, 100, "LoopForever")).toBe(0);
  });
});

// ============================================
// LoopOnce Tests
// ============================================

describe("Animation frame calculation - LoopOnce", () => {
  it("should return frame 0 at elapsed=0", () => {
    const frame = calculateFrameIndex(0, 4, 100, "LoopOnce");
    expect(frame).toBe(0);
  });

  it("should advance frame at each frameDelay", () => {
    const frameCount = 4;
    const frameDelay = 100;

    expect(calculateFrameIndex(0, frameCount, frameDelay, "LoopOnce")).toBe(0);
    expect(calculateFrameIndex(100, frameCount, frameDelay, "LoopOnce")).toBe(1);
    expect(calculateFrameIndex(200, frameCount, frameDelay, "LoopOnce")).toBe(2);
    expect(calculateFrameIndex(300, frameCount, frameDelay, "LoopOnce")).toBe(3);
  });

  it("should stop at last frame after totalDuration", () => {
    const frameCount = 4;
    const frameDelay = 100;
    const totalDuration = frameCount * frameDelay; // 400ms

    // At totalDuration, should be at last frame
    expect(calculateFrameIndex(totalDuration, frameCount, frameDelay, "LoopOnce")).toBe(3);
    expect(calculateFrameIndex(totalDuration + 1, frameCount, frameDelay, "LoopOnce")).toBe(3);
    expect(calculateFrameIndex(totalDuration + 100, frameCount, frameDelay, "LoopOnce")).toBe(3);
  });

  it("should stay on last frame for very large elapsed", () => {
    const frameCount = 4;
    const frameDelay = 100;

    expect(calculateFrameIndex(10000, frameCount, frameDelay, "LoopOnce")).toBe(3);
    expect(calculateFrameIndex(999999, frameCount, frameDelay, "LoopOnce")).toBe(3);
  });

  it("should handle single-frame animation", () => {
    expect(calculateFrameIndex(0, 1, 100, "LoopOnce")).toBe(0);
    expect(calculateFrameIndex(99, 1, 100, "LoopOnce")).toBe(0);
    expect(calculateFrameIndex(100, 1, 100, "LoopOnce")).toBe(0);
    expect(calculateFrameIndex(999, 1, 100, "LoopOnce")).toBe(0);
  });

  it("should handle boundary at totalDuration - 1", () => {
    const frameCount = 4;
    const frameDelay = 100;
    const totalDuration = frameCount * frameDelay; // 400ms

    // One ms before totalDuration, should be at last frame
    expect(calculateFrameIndex(totalDuration - 1, frameCount, frameDelay, "LoopOnce")).toBe(3);
  });
});

// ============================================
// Frame path generation Tests
// ============================================

describe("Animation frame path generation", () => {
  it("should replace dot with frame index (zero-based)", () => {
    expect(getFramePath("sprite.png", 0)).toBe("sprite0.png");
    expect(getFramePath("sprite.png", 1)).toBe("sprite1.png");
    expect(getFramePath("sprite.png", 9)).toBe("sprite9.png");
  });

  it("should handle path with multiple dots", () => {
    // lastIndexOf finds the last dot, so "my.sprite.png" → "my.sprite0.png"
    expect(getFramePath("my.sprite.png", 0)).toBe("my.sprite0.png");
    expect(getFramePath("my.sprite.png", 5)).toBe("my.sprite5.png");
  });

  it("should handle path without extension", () => {
    expect(getFramePath("sprite", 0)).toBe("sprite");
    expect(getFramePath("sprite", 5)).toBe("sprite");
  });

  it("should handle multi-digit frame indices", () => {
    expect(getFramePath("sprite.png", 10)).toBe("sprite10.png");
    expect(getFramePath("sprite.png", 99)).toBe("sprite99.png");
  });

  it("should handle paths with directory separators", () => {
    expect(getFramePath("SB/sprite.png", 3)).toBe("SB/sprite3.png");
    expect(getFramePath("SB/My Sprite.png", 0)).toBe("SB/My Sprite0.png");
  });
});

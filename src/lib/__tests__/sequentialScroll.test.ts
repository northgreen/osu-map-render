import { describe, it, expect } from "vitest";
import { SequentialScrollAlgorithm, ScrollVelocitySegment } from "../scrollVelocity";

function createSVSegment(startTime: number, scrollVelocity: number): ScrollVelocitySegment {
  return { startTime, scrollVelocity };
}

describe("SequentialScrollAlgorithm", () => {
  describe("Constant SV (no changes)", () => {
    it("returns ~0 for note at future with timeRange distance", () => {
      const algo = new SequentialScrollAlgorithm([createSVSegment(0, 1)], 1000);
      expect(algo.getProgress(1000, 0)).toBeCloseTo(0, 5);
    });

    it("returns ~1 for note at judgment line", () => {
      const algo = new SequentialScrollAlgorithm([createSVSegment(0, 1)], 1000);
      expect(algo.getProgress(0, 0)).toBeCloseTo(1, 5);
    });

    it("returns ~1.5 for note already passed", () => {
      const algo = new SequentialScrollAlgorithm([createSVSegment(0, 1)], 1000);
      expect(algo.getProgress(-500, 0)).toBeCloseTo(1.5, 5);
    });
  });

  describe("SV changes", () => {
    it("accounts for faster scroll after SV change", () => {
      const algo = new SequentialScrollAlgorithm(
        [createSVSegment(0, 1), createSVSegment(500, 2)],
        1000
      );
      const progress = algo.getProgress(750, 0);
      const constantAlgo = new SequentialScrollAlgorithm([createSVSegment(0, 1)], 1000);
      const constantProgress = constantAlgo.getProgress(500, 0);
      expect(progress).toBeLessThan(constantProgress);
    });
  });

  describe("Edge cases", () => {
    it("falls back to constant formula for empty segments", () => {
      const algo = new SequentialScrollAlgorithm([], 1000);
      expect(algo.getProgress(500, 0)).toBeCloseTo(0.5, 5);
    });

    it("handles very large SV", () => {
      const algo = new SequentialScrollAlgorithm([createSVSegment(0, 10)], 1000);
      expect(algo.getProgress(100, 0)).toBeCloseTo(0, 5);
    });

    it("handles very small SV", () => {
      const algo = new SequentialScrollAlgorithm([createSVSegment(0, 0.1)], 1000);
      expect(algo.getProgress(1000, 0)).toBeCloseTo(0.9, 5);
    });
  });

  describe("Position mapping", () => {
    it("returns values between 0 and 1 for notes within visible range", () => {
      const algo = new SequentialScrollAlgorithm([createSVSegment(0, 1)], 1000);
      for (let noteTime = 0; noteTime <= 1000; noteTime += 100) {
        const progress = algo.getProgress(noteTime, 0);
        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(1);
      }
    });

    it("maintains monotonicity for future notes", () => {
      const algo = new SequentialScrollAlgorithm([createSVSegment(0, 1)], 1000);
      let prevProgress = Infinity;
      for (let noteTime = 0; noteTime <= 1000; noteTime += 100) {
        const progress = algo.getProgress(noteTime, 0);
        expect(progress).toBeLessThanOrEqual(prevProgress);
        prevProgress = progress;
      }
    });
  });
});

import { describe, it, expect } from "vitest";
import {
  getOpacity,
} from "../../../storyboard/command-evaluator";
import { getLoopOpacity } from "../../../storyboard/loop-evaluator";
import type { SbLoop } from "../../../sbParser";
import {
  createFCommand,
  createLoop,
} from "../../test-utils";

// ============================================
// 1. Loop F command interpolation (opacity)
// ============================================

describe("Loop F command interpolation (opacity)", () => {
  it("should interpolate F opacity within loop", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createFCommand(0, 500, 0, 1)], 500),
    ];
    const opacity = getOpacity([], loops, 250);
    expect(opacity).toBeCloseTo(0.5);
  });

  it("should interpolate F opacity correctly in each iteration", () => {
    const loops: SbLoop[] = [
      createLoop(0, 3, [createFCommand(0, 1000, 0, 1)], 1000),
    ];
    // Iteration 0, 25% through
    const op0 = getOpacity([], loops, 250);
    expect(op0).toBeCloseTo(0.25);
    // Iteration 1, 25% through
    const op1 = getOpacity([], loops, 1250);
    expect(op1).toBeCloseTo(0.25);
  });

  it("should handle fade out within loop", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createFCommand(0, 500, 1, 0)], 500),
    ];
    const opacity = getOpacity([], loops, 250);
    expect(opacity).toBeCloseTo(0.5);
  });

  it("should handle getLoopOpacity directly", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createFCommand(0, 500, 0, 1)], 500),
    ];
    const opacity = getLoopOpacity(loops, 250);
    expect(opacity).toBeCloseTo(0.5);
  });
});

// ============================================
// 2. Loop edge cases - opacity related
// ============================================

describe("Loop edge cases - opacity before loop starts", () => {
  it("should return null opacity before loop starts", () => {
    const loops: SbLoop[] = [
      createLoop(1000, 2, [createFCommand(0, 500, 0, 1)], 500),
    ];
    const opacity = getLoopOpacity(loops, 500);
    expect(opacity).toBeNull();
  });
});

describe("Loop edge cases - instant F command", () => {
  it("should skip loop with instant F command", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createFCommand(0, 0, 0, 1)], 1000),
    ];
    const opacity = getLoopOpacity(loops, 500);
    // Loop skipped due to duration <= 0
    expect(opacity).toBeNull();
  });
});

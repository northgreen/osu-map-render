import { describe, it, expect } from "vitest";
import {
  getRotation,
} from "../../../storyboard/command-evaluator";
import type { SbLoop } from "../../../sbParser";
import {
  createRCommand,
  createLoop,
} from "../../test-utils";

// ============================================
// 1. Loop R command interpolation
// ============================================

describe("Loop R command interpolation", () => {
  it("should interpolate R rotation within loop", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createRCommand(0, 500, 0, Math.PI)], 500),
    ];
    const rotation = getRotation([], loops, 250);
    // At midpoint: 0.5 * PI radians = 90 degrees
    expect(rotation).toBeCloseTo(90);
  });

  it("should interpolate R rotation correctly in each iteration", () => {
    const loops: SbLoop[] = [
      createLoop(0, 3, [createRCommand(0, 1000, 0, 2 * Math.PI)], 1000),
    ];
    // Iteration 1, 25% through: 0.25 * 2PI = PI/2 = 90 degrees
    const rotation = getRotation([], loops, 1250);
    expect(rotation).toBeCloseTo(90);
  });
});

// ============================================
// 2. Loop edge cases - rotation related
// ============================================

describe("Loop edge cases - after-loop rotation persistence", () => {
  it("should persist rotation after loop completes", () => {
    const loops: SbLoop[] = [
      createLoop(0, 1, [createRCommand(0, 500, 0, Math.PI)], 500),
    ];
    const rotation = getRotation([], loops, 2000);
    // PI radians = 180 degrees
    expect(rotation).toBeCloseTo(180);
  });
});

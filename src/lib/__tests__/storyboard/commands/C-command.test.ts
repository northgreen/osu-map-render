import { describe, it, expect } from "vitest";
import {
  getColor,
} from "../../../storyboard/command-evaluator";
import type { SbLoop } from "../../../sbParser";
import {
  createCCommand,
  createLoop,
} from "../../test-utils";

// ============================================
// 1. Loop C command interpolation
// ============================================

describe("Loop C command interpolation", () => {
  it("should interpolate C color within loop", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createCCommand(0, 500, 255, 0, 0, 0, 255, 0)], 500),
    ];
    const color = getColor([], loops, 250);
    // sRGB midpoint 0.5 → linear ≈ 0.214
    expect(color!.r).toBeCloseTo(0.21404);
    expect(color!.g).toBeCloseTo(0.21404);
    expect(color!.b).toBeCloseTo(0);
  });

  it("should interpolate C color correctly in each iteration", () => {
    const loops: SbLoop[] = [
      createLoop(0, 3, [createCCommand(0, 1000, 0, 0, 0, 255, 255, 255)], 1000),
    ];
    // Iteration 1, 50% through
    const color = getColor([], loops, 1500);
    // sRGB midpoint 0.5 → linear ≈ 0.214
    expect(color!.r).toBeCloseTo(0.21404);
    expect(color!.g).toBeCloseTo(0.21404);
    expect(color!.b).toBeCloseTo(0.21404);
  });
});

// ============================================
// 2. Loop edge cases - color related
// ============================================

describe("Loop edge cases - color before loop starts", () => {
  it("should return null color before loop starts", () => {
    const loops: SbLoop[] = [
      createLoop(1000, 2, [createCCommand(0, 500, 255, 0, 0, 0, 255, 0)], 500),
    ];
    const color = getColor([], loops, 500);
    expect(color).toBeNull();
  });
});

describe("Loop edge cases - after-loop color persistence", () => {
  it("should persist color after loop completes", () => {
    const loops: SbLoop[] = [
      createLoop(0, 1, [createCCommand(0, 500, 255, 0, 0, 0, 0, 255)], 500),
    ];
    const color = getColor([], loops, 2000);
    // After loop ends, use end value of last C command
    expect(color!.r).toBeCloseTo(0);
    expect(color!.g).toBeCloseTo(0);
    expect(color!.b).toBeCloseTo(1);
  });
});

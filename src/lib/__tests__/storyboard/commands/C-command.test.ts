import { describe, it, expect } from "vitest";
import {
  getColor,
} from "../../../storyboard/command-evaluator";
import type { SbCommand, SbLoop } from "../../../sbParser";
import {
  createCCommand,
  createLoop,
} from "../../test-utils";

// Match the gamma correction in command-evaluator.ts
function srgbToLinear(c: number): number {
  if (c === 1) return 1;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

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

// ============================================
// 3. Multiple C commands - overlapping/sequential
// ============================================

describe("multiple C commands", () => {
  it("returns last ended command's color when multiple commands have ended", () => {
    const commands: SbCommand[] = [
      {
        type: "C",
        easing: 0,
        startTime: 117379,
        endTime: 117379,
        params: [255, 43, 149, 255, 43, 149], // Pink
      },
      {
        type: "C",
        easing: 0,
        startTime: 117379,
        endTime: 117380,
        params: [255, 43, 149, 255, 255, 255], // Pink → White
      },
    ];

    // After both commands ended, should return last command's end value (white)
    const color = getColor(commands, [], 118260);
    expect(color).not.toBeNull();
    // White in linear space: srgbToLinear(1.0) = 1.0
    expect(color!.r).toBeCloseTo(1.0, 5);
    expect(color!.g).toBeCloseTo(1.0, 5);
    expect(color!.b).toBeCloseTo(1.0, 5);
  });

  it("interpolates active command when multiple commands overlap", () => {
    const commands: SbCommand[] = [
      {
        type: "C",
        easing: 0,
        startTime: 1000,
        endTime: 2000,
        params: [255, 0, 0, 255, 0, 0], // Red
      },
      {
        type: "C",
        easing: 0,
        startTime: 1500,
        endTime: 2500,
        params: [0, 255, 0, 0, 255, 0], // Green (static)
      },
    ];

    // At 1750ms, second command is active (midway through)
    const color = getColor(commands, [], 1750);
    expect(color).not.toBeNull();
    // Should return green command (active), not red
    // Green is static: srgbToLinear(1.0) = 1.0
    expect(color!.g).toBeCloseTo(1.0, 5);
    expect(color!.r).toBeCloseTo(srgbToLinear(0), 5);
    expect(color!.b).toBeCloseTo(srgbToLinear(0), 5);
  });

  it("returns correct color when sequential commands end in order", () => {
    const commands: SbCommand[] = [
      {
        type: "C",
        easing: 0,
        startTime: 1000,
        endTime: 2000,
        params: [255, 0, 0, 255, 0, 0], // Red
      },
      {
        type: "C",
        easing: 0,
        startTime: 2000,
        endTime: 3000,
        params: [0, 255, 0, 0, 255, 0], // Green
      },
      {
        type: "C",
        easing: 0,
        startTime: 3000,
        endTime: 4000,
        params: [0, 0, 255, 0, 0, 255], // Blue
      },
    ];

    // After all commands ended → blue (last ended command's end value)
    const colorBlue = getColor(commands, [], 5000);
    expect(colorBlue!.b).toBeCloseTo(1.0, 5);
    expect(colorBlue!.r).toBeCloseTo(0, 5);
    expect(colorBlue!.g).toBeCloseTo(0, 5);

    // At 3500, blue command is active → blue
    const colorActiveBlue = getColor(commands, [], 3500);
    expect(colorActiveBlue!.b).toBeCloseTo(1.0, 5);
    expect(colorActiveBlue!.r).toBeCloseTo(0, 5);
    expect(colorActiveBlue!.g).toBeCloseTo(0, 5);

    // At 2500, green command is active → green
    const colorActiveGreen = getColor(commands, [], 2500);
    expect(colorActiveGreen!.g).toBeCloseTo(1.0, 5);
    expect(colorActiveGreen!.r).toBeCloseTo(0, 5);
    expect(colorActiveGreen!.b).toBeCloseTo(0, 5);
  });
});

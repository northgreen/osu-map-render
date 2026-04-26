import { describe, it, expect } from "vitest";
import {
  getVectorScale,
} from "../../../storyboard/command-evaluator";
import type { SbCommand, SbLoop } from "../../../sbParser";
import {
  createVCommand,
  createLoop,
  noLoops,
} from "../../test-utils";

// ============================================
// 1. getVectorScale - Default (no V commands)
// ============================================

describe("getVectorScale - Default (no V commands)", () => {
  it("should return null when no V commands exist", () => {
    const vs = getVectorScale([], noLoops, 0);
    expect(vs).toBeNull();
  });

  it("should default to {x:1, y:1} when null is returned", () => {
    const vs = getVectorScale([], noLoops, 0);
    const scaleX = vs ? vs.x : 1;
    const scaleY = vs ? vs.y : 1;
    expect(scaleX).toBe(1);
    expect(scaleY).toBe(1);
  });
});

// ============================================
// 2. getVectorScale - Static V command
// ============================================

describe("getVectorScale - Static V command", () => {
  it("should return static vector scale during command", () => {
    const commands = [createVCommand(0, 1000, 2, 3, 2, 3)];
    const vs = getVectorScale(commands, noLoops, 500);
    expect(vs).toEqual({ x: 2, y: 3 });
  });

  it("should return start values before command starts", () => {
    const commands = [createVCommand(1000, 2000, 1.5, 2.5, 3, 4)];
    const vs = getVectorScale(commands, noLoops, 500);
    expect(vs).toEqual({ x: 1.5, y: 2.5 });
  });

  it("should return end values after command completes", () => {
    const commands = [createVCommand(0, 1000, 1, 1, 2, 3)];
    const vs = getVectorScale(commands, noLoops, 2000);
    expect(vs).toEqual({ x: 2, y: 3 });
  });
});

// ============================================
// 3. getVectorScale - V command transitions
// ============================================

describe("getVectorScale - V command transitions", () => {
  it("should interpolate X and Y independently", () => {
    const commands = [createVCommand(0, 1000, 1, 1, 3, 5)];
    const vs = getVectorScale(commands, noLoops, 500);
    expect(vs!.x).toBeCloseTo(2);
    expect(vs!.y).toBeCloseTo(3);
  });

  it("should return start values at exact start time", () => {
    const commands = [createVCommand(1000, 2000, 1, 2, 3, 4)];
    const vs = getVectorScale(commands, noLoops, 1000);
    expect(vs!.x).toBeCloseTo(1);
    expect(vs!.y).toBeCloseTo(2);
  });

  it("should return end values at exact end time", () => {
    const commands = [createVCommand(1000, 2000, 1, 2, 3, 4)];
    const vs = getVectorScale(commands, noLoops, 2000);
    expect(vs!.x).toBeCloseTo(3);
    expect(vs!.y).toBeCloseTo(4);
  });

  it("should handle non-uniform scaling (different X and Y)", () => {
    // Stretch horizontally only
    const commands = [createVCommand(0, 1000, 1, 1, 3, 1)];
    const vs = getVectorScale(commands, noLoops, 500);
    expect(vs!.x).toBeCloseTo(2);
    expect(vs!.y).toBeCloseTo(1);
  });

  it("should handle non-uniform scaling (different Y only)", () => {
    // Stretch vertically only
    const commands = [createVCommand(0, 1000, 1, 1, 1, 3)];
    const vs = getVectorScale(commands, noLoops, 500);
    expect(vs!.x).toBeCloseTo(1);
    expect(vs!.y).toBeCloseTo(2);
  });

  it("should handle fractional vector scale values", () => {
    const commands = [createVCommand(0, 1000, 0.5, 0.5, 1.5, 1.5)];
    const vs = getVectorScale(commands, noLoops, 500);
    expect(vs!.x).toBeCloseTo(1);
    expect(vs!.y).toBeCloseTo(1);
  });
});

// ============================================
// 4. getVectorScale - V command with loops
// ============================================

describe("getVectorScale - V command with loops", () => {
  it("should return vector scale from active loop", () => {
    const commands: SbCommand[] = [];
    const loops: SbLoop[] = [
      createLoop(0, 2, [
        createVCommand(0, 500, 1, 1, 2, 2),
      ], 500),
    ];
    const vs = getVectorScale(commands, loops, 250);
    expect(vs!.x).toBeCloseTo(1.5);
    expect(vs!.y).toBeCloseTo(1.5);
  });

  it("should return vector scale from second loop iteration", () => {
    const commands: SbCommand[] = [];
    const loops: SbLoop[] = [
      createLoop(0, 2, [
        createVCommand(0, 500, 1, 1, 2, 3),
      ], 500),
    ];
    const vs = getVectorScale(commands, loops, 750);
    expect(vs!.x).toBeCloseTo(1.5);
    expect(vs!.y).toBeCloseTo(2);
  });
});

// ============================================
// 5. Loop V command interpolation
// ============================================

describe("Loop V command interpolation", () => {
  it("should interpolate V vector scale within loop", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createVCommand(0, 500, 1, 1, 3, 5)], 500),
    ];
    const vs = getVectorScale([], loops, 250);
    expect(vs!.x).toBeCloseTo(2);
    expect(vs!.y).toBeCloseTo(3);
  });

  it("should interpolate V vector scale independently per iteration", () => {
    const loops: SbLoop[] = [
      createLoop(0, 3, [createVCommand(0, 1000, 1, 1, 2, 3)], 1000),
    ];
    // Iteration 1, 50% through
    const vs = getVectorScale([], loops, 1500);
    expect(vs!.x).toBeCloseTo(1.5);
    expect(vs!.y).toBeCloseTo(2);
  });
});

import { describe, it, expect } from "vitest";
import {
  getScale,
} from "../../../storyboard/command-evaluator";
import type { SbCommand, SbLoop } from "../../../sbParser";
import {
  createSCommand,
  createLoop,
  noLoops,
} from "../../test-utils";

// ============================================
// 1. getScale - Default scale (no S commands)
// ============================================

describe("getScale - Default scale (no S commands)", () => {
  it("should return 1 when no S commands exist", () => {
    const scale = getScale([], noLoops, 0);
    expect(scale).toBe(1);
  });

  it("should return 1 at any time when no S commands exist", () => {
    const scale = getScale([], noLoops, 5000);
    expect(scale).toBe(1);
  });
});

// ============================================
// 2. getScale - Static S command
// ============================================

describe("getScale - Static S command", () => {
  it("should return static scale value during command", () => {
    const commands = [createSCommand(0, 1000, 2, 2)];
    const scale = getScale(commands, noLoops, 500);
    expect(scale).toBe(2);
  });

  it("should return static scale value before command starts", () => {
    const commands = [createSCommand(1000, 2000, 3, 3)];
    const scale = getScale(commands, noLoops, 500);
    // osu! pre-read: returns start value
    expect(scale).toBe(3);
  });

  it("should return static scale value after command ends", () => {
    const commands = [createSCommand(0, 1000, 2.5, 2.5)];
    const scale = getScale(commands, noLoops, 2000);
    expect(scale).toBe(2.5);
  });
});

// ============================================
// 3. getScale - S command transitions
// ============================================

describe("getScale - S command transitions", () => {
  it("should interpolate scale from start to end", () => {
    const commands = [createSCommand(0, 1000, 1, 3)];
    const scale = getScale(commands, noLoops, 500);
    expect(scale).toBeCloseTo(2);
  });

  it("should return start scale at exact start time", () => {
    const commands = [createSCommand(1000, 2000, 1, 4)];
    const scale = getScale(commands, noLoops, 1000);
    expect(scale).toBe(1);
  });

  it("should return end scale at exact end time", () => {
    const commands = [createSCommand(1000, 2000, 1, 4)];
    const scale = getScale(commands, noLoops, 2000);
    expect(scale).toBe(4);
  });

  it("should persist end scale after command completes", () => {
    const commands = [createSCommand(0, 1000, 1, 5)];
    const scale = getScale(commands, noLoops, 2000);
    expect(scale).toBe(5);
  });

  it("should handle scale down (end < start)", () => {
    const commands = [createSCommand(0, 1000, 4, 1)];
    const scale = getScale(commands, noLoops, 500);
    expect(scale).toBeCloseTo(2.5);
  });

  it("should handle fractional scale values", () => {
    const commands = [createSCommand(0, 1000, 0.5, 1.5)];
    const scale = getScale(commands, noLoops, 500);
    expect(scale).toBeCloseTo(1);
  });

  it("should handle instant scale change", () => {
    const commands = [createSCommand(1000, 1000, 1, 3)];
    const before = getScale(commands, noLoops, 999);
    expect(before).toBe(1);
    const at = getScale(commands, noLoops, 1000);
    expect(at).toBe(1); // interpolateWithEasing returns startValue at startTime
    const after = getScale(commands, noLoops, 1001);
    expect(after).toBe(3);
  });
});

// ============================================
// 4. getScale - S command with loops
// ============================================

describe("getScale - S command with loops", () => {
  it("should return scale from active loop", () => {
    const commands: SbCommand[] = [];
    const loops: SbLoop[] = [
      createLoop(0, 2, [
        createSCommand(0, 500, 1, 2),
      ], 500),
    ];
    const scale = getScale(commands, loops, 250);
    expect(scale).toBeCloseTo(1.5);
  });

  it("should return scale from second loop iteration", () => {
    const commands: SbCommand[] = [];
    const loops: SbLoop[] = [
      createLoop(0, 2, [
        createSCommand(0, 500, 1, 2),
      ], 500),
    ];
    const scale = getScale(commands, loops, 750);
    expect(scale).toBeCloseTo(1.5);
  });

  it("should use end value after loop completes", () => {
    const commands: SbCommand[] = [];
    const loops: SbLoop[] = [
      createLoop(0, 1, [ // 2 iterations
        createSCommand(0, 500, 1, 3),
      ], 500),
    ];
    const scale = getScale(commands, loops, 1500);
    expect(scale).toBe(3);
  });
});

// ============================================
// 5. Loop S command interpolation
// ============================================

describe("Loop S command interpolation", () => {
  it("should interpolate S scale within loop", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createSCommand(0, 500, 1, 3)], 500),
    ];
    const scale = getScale([], loops, 250);
    expect(scale).toBeCloseTo(2);
  });

  it("should interpolate S scale correctly in each iteration", () => {
    const loops: SbLoop[] = [
      createLoop(0, 3, [createSCommand(0, 1000, 1, 5)], 1000),
    ];
    // Iteration 0, 50% through
    const scale0 = getScale([], loops, 500);
    expect(scale0).toBeCloseTo(3);
    // Iteration 1, 50% through
    const scale1 = getScale([], loops, 1500);
    expect(scale1).toBeCloseTo(3);
  });

  it("should handle scale down within loop", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createSCommand(0, 500, 3, 1)], 500),
    ];
    const scale = getScale([], loops, 250);
    expect(scale).toBeCloseTo(2);
  });
});

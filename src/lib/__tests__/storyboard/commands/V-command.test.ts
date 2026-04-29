import { describe, it, expect } from "vitest";
import {
  getVectorScale,
  getNegativeScale,
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

// ============================================
// 6. getVectorScale - Multiple V commands
// ============================================

describe("getVectorScale - Multiple V commands", () => {
  it("should use last active command when multiple overlap", () => {
    const commands: SbCommand[] = [
      createVCommand(0, 2000, 1, 1, 2, 2), // Active 0-2000
      createVCommand(1000, 1500, 3, 3, 4, 4), // Active 1000-1500 (overlaps)
    ];
    // At t=1200, both active -> last active (3-4 range) takes precedence
    const vs = getVectorScale(commands, noLoops, 1200);
    expect(vs!.x).toBeCloseTo(3.4);
    expect(vs!.y).toBeCloseTo(3.4);
  });

  it("should use last ended command's end value when all commands have ended", () => {
    const commands: SbCommand[] = [
      createVCommand(0, 500, 1, 1, 2, 2), // Ended at 500
      createVCommand(600, 1000, 3, 3, 5, 5), // Ended at 1000
    ];
    // At t=1500, both ended -> last ended (5,5) takes precedence
    const vs = getVectorScale(commands, noLoops, 1500);
    expect(vs).toEqual({ x: 5, y: 5 });
  });

  it("should prioritize active command over ended command", () => {
    const commands: SbCommand[] = [
      createVCommand(0, 500, 1, 1, 2, 2), // Ended at 500
      createVCommand(1000, 2000, 3, 3, 6, 6), // Active at 1500
    ];
    // At t=1500: first ended, second active -> second wins
    const vs = getVectorScale(commands, noLoops, 1500);
    expect(vs!.x).toBeCloseTo(4.5);
    expect(vs!.y).toBeCloseTo(4.5);
  });

  it("should pre-read first command's start value when all in future", () => {
    const commands: SbCommand[] = [
      createVCommand(2000, 3000, 1, 1, 2, 2),
      createVCommand(1000, 2000, 3, 3, 4, 4),
    ];
    // Sorted: [1000-2000, 2000-3000]
    // At t=0: both in future -> pre-read first (3,3)
    const vs = getVectorScale(commands, noLoops, 0);
    expect(vs).toEqual({ x: 3, y: 3 });
  });

  it("should handle sequential non-overlapping commands correctly", () => {
    const commands: SbCommand[] = [
      createVCommand(0, 1000, 1, 1, 2, 2),
      createVCommand(1000, 2000, 2, 2, 3, 3),
      createVCommand(2000, 3000, 3, 3, 4, 4),
    ];
    // During first
    const vs1 = getVectorScale(commands, noLoops, 500);
    expect(vs1!.x).toBeCloseTo(1.5);
    expect(vs1!.y).toBeCloseTo(1.5);
    // During second
    const vs2 = getVectorScale(commands, noLoops, 1500);
    expect(vs2!.x).toBeCloseTo(2.5);
    expect(vs2!.y).toBeCloseTo(2.5);
    // During third
    const vs3 = getVectorScale(commands, noLoops, 2500);
    expect(vs3!.x).toBeCloseTo(3.5);
    expect(vs3!.y).toBeCloseTo(3.5);
    // After all ended
    const vs4 = getVectorScale(commands, noLoops, 4000);
    expect(vs4).toEqual({ x: 4, y: 4 });
  });

  it("should match real-world scenario: multiple V commands at 108210ms", () => {
    // Real scenario from SB/White.jpg sprite_209
    const commands: SbCommand[] = [
      createVCommand(102566, 108004, 0.1441379, 0.9117241, 0.1882759, 0.9382067),
      createVCommand(108004, 108191, 0.1882759, 0.9382067, 0.2853792, 1.026482),
      createVCommand(108191, 108379, 0.2853792, 1.026482, 0.2942066, 0.9646893),
    ];
    // At 108210ms: first two ended, third active
    const vs = getVectorScale(commands, noLoops, 108210);
    // Third command: interpolate at (108210-108191)/(108379-108191) = 19/188 ≈ 0.101
    const t = 19 / 188;
    const expectedX = 0.2853792 + (0.2942066 - 0.2853792) * t;
    const expectedY = 1.026482 + (0.9646893 - 1.026482) * t;
    expect(vs!.x).toBeCloseTo(expectedX, 4);
    expect(vs!.y).toBeCloseTo(expectedY, 4);
  });
});

// ============================================
// 7. getNegativeScale Tests
// ============================================

describe("getNegativeScale", () => {
  it("should return false,false for positive vector scale", () => {
    const commands = [createVCommand(0, 1000, 1, 1, 2, 2)];
    const result = getNegativeScale(commands, noLoops, 500);
    expect(result.scaleXNeg).toBe(false);
    expect(result.scaleYNeg).toBe(false);
  });

  it("should return true,false for negative X scale", () => {
    const commands = [createVCommand(0, 1000, 1, 1, -2, 2)];
    const result = getNegativeScale(commands, noLoops, 500);
    expect(result.scaleXNeg).toBe(true);
    expect(result.scaleYNeg).toBe(false);
  });

  it("should return false,true for negative Y scale", () => {
    const commands = [createVCommand(0, 1000, 1, 1, 2, -3)];
    const result = getNegativeScale(commands, noLoops, 500);
    expect(result.scaleXNeg).toBe(false);
    expect(result.scaleYNeg).toBe(true);
  });

  it("should return true,true for both negative scales", () => {
    const commands = [createVCommand(0, 1000, 1, 1, -2, -3)];
    const result = getNegativeScale(commands, noLoops, 500);
    expect(result.scaleXNeg).toBe(true);
    expect(result.scaleYNeg).toBe(true);
  });

  it("should handle V commands in loops", () => {
    const commands: SbCommand[] = [];
    const loops: SbLoop[] = [
      createLoop(0, 2, [
        createVCommand(0, 500, 1, 1, -2, -3),
      ], 500),
    ];
    const result = getNegativeScale(commands, loops, 250);
    expect(result.scaleXNeg).toBe(true);
    expect(result.scaleYNeg).toBe(true);
  });

  it("should return false,false when no V commands exist", () => {
    const result = getNegativeScale([], noLoops, 500);
    expect(result.scaleXNeg).toBe(false);
    expect(result.scaleYNeg).toBe(false);
  });
});

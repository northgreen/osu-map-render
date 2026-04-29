import { describe, it, expect } from "vitest";
import {
  getRotation,
} from "../../../storyboard/command-evaluator";
import type { SbCommand, SbLoop } from "../../../sbParser";
import {
  createRCommand,
  createLoop,
  noLoops,
} from "../../test-utils";

// ============================================
// 1. getRotation - Default (no R commands)
// ============================================

describe("getRotation - Default (no R commands)", () => {
  it("should return 0 when no R commands exist", () => {
    const rotation = getRotation([], noLoops, 0);
    expect(rotation).toBe(0);
  });

  it("should return 0 at any time when no R commands exist", () => {
    const rotation = getRotation([], noLoops, 5000);
    expect(rotation).toBe(0);
  });
});

// ============================================
// 2. getRotation - Static R command
// ============================================

describe("getRotation - Static R command", () => {
  it("should return static rotation during command", () => {
    const commands = [createRCommand(0, 1000, 45, 45)];
    const rotation = getRotation(commands, noLoops, 500);
    expect(rotation).toBe(45);
  });

  it("should return start value before command starts", () => {
    const commands = [createRCommand(1000, 2000, 90, 180)];
    const rotation = getRotation(commands, noLoops, 500);
    expect(rotation).toBe(90);
  });

  it("should return end value after command completes", () => {
    const commands = [createRCommand(0, 1000, 0, 180)];
    const rotation = getRotation(commands, noLoops, 2000);
    expect(rotation).toBe(180);
  });
});

// ============================================
// 3. getRotation - R command transitions
// ============================================

describe("getRotation - R command transitions", () => {
  it("should interpolate rotation from start to end", () => {
    const commands = [createRCommand(0, 1000, 0, 180)];
    const rotation = getRotation(commands, noLoops, 500);
    expect(rotation).toBeCloseTo(90);
  });

  it("should return start rotation at exact start time", () => {
    const commands = [createRCommand(1000, 2000, 0, 360)];
    const rotation = getRotation(commands, noLoops, 1000);
    expect(rotation).toBe(0);
  });

  it("should return end rotation at exact end time", () => {
    const commands = [createRCommand(1000, 2000, 0, 360)];
    const rotation = getRotation(commands, noLoops, 2000);
    expect(rotation).toBe(360);
  });

  it("should persist end rotation after command completes", () => {
    const commands = [createRCommand(0, 1000, 0, 270)];
    const rotation = getRotation(commands, noLoops, 2000);
    expect(rotation).toBe(270);
  });

  it("should handle negative rotation (counter-clockwise)", () => {
    const commands = [createRCommand(0, 1000, 0, -90)];
    const rotation = getRotation(commands, noLoops, 500);
    expect(rotation).toBeCloseTo(-45);
  });
});

// ============================================
// 4. getRotation - R command with loops
// ============================================

describe("getRotation - R command with loops", () => {
  it("should return rotation from active loop", () => {
    const commands: SbCommand[] = [];
    const loops: SbLoop[] = [
      createLoop(0, 2, [
        createRCommand(0, 500, 0, 180),
      ], 500),
    ];
    const rotation = getRotation(commands, loops, 250);
    expect(rotation).toBeCloseTo(90);
  });

  it("should return rotation from second loop iteration", () => {
    const commands: SbCommand[] = [];
    const loops: SbLoop[] = [
      createLoop(0, 2, [
        createRCommand(0, 500, 0, 180),
      ], 500),
    ];
    const rotation = getRotation(commands, loops, 750);
    expect(rotation).toBeCloseTo(90);
  });
});

// ============================================
// 5. Loop R command interpolation
// ============================================

describe("Loop R command interpolation", () => {
  it("should interpolate R rotation within loop", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createRCommand(0, 500, 0, 180)], 500),
    ];
    const rotation = getRotation([], loops, 250);
    // At midpoint: 0.5 * 180 = 90 degrees
    expect(rotation).toBeCloseTo(90);
  });

  it("should interpolate R rotation correctly in each iteration", () => {
    const loops: SbLoop[] = [
      createLoop(0, 3, [createRCommand(0, 1000, 0, 360)], 1000),
    ];
    // Iteration 1, 25% through: 0.25 * 360 = 90 degrees
    const rotation = getRotation([], loops, 1250);
    expect(rotation).toBeCloseTo(90);
  });
});

// ============================================
// 6. Loop edge cases - rotation related
// ============================================

describe("Loop edge cases - after-loop rotation persistence", () => {
  it("should persist rotation after loop completes", () => {
    const loops: SbLoop[] = [
      createLoop(0, 1, [createRCommand(0, 500, 0, 180)], 500),
    ];
    const rotation = getRotation([], loops, 2000);
    // 180 degrees
    expect(rotation).toBeCloseTo(180);
  });
});

// ============================================
// 7. getRotation - Multiple R commands
// ============================================

describe("getRotation - Multiple R commands", () => {
  it("should use last active command when multiple overlap", () => {
    const commands: SbCommand[] = [
      createRCommand(0, 2000, 0, 90), // Active 0-2000
      createRCommand(1000, 1500, 180, 270), // Active 1000-1500 (overlaps)
    ];
    // At t=1200, both active -> last active (180-270 range) takes precedence
    // t = (1200-1000)/(1500-1000) = 0.4, value = 180 + 90*0.4 = 216
    const rotation = getRotation(commands, noLoops, 1200);
    expect(rotation).toBeCloseTo(216);
  });

  it("should use last ended command's end value when all commands have ended", () => {
    const commands: SbCommand[] = [
      createRCommand(0, 500, 0, 90), // Ended at 500
      createRCommand(600, 1000, 180, 270), // Ended at 1000
    ];
    // At t=1500, both ended -> last ended (270) takes precedence
    const rotation = getRotation(commands, noLoops, 1500);
    expect(rotation).toBe(270);
  });

  it("should prioritize active command over ended command", () => {
    const commands: SbCommand[] = [
      createRCommand(0, 500, 0, 90), // Ended at 500
      createRCommand(1000, 2000, 180, 360), // Active at 1500
    ];
    // At t=1500: first ended, second active -> second wins
    const rotation = getRotation(commands, noLoops, 1500);
    expect(rotation).toBeCloseTo(270);
  });

  it("should pre-read first command's start value when all in future", () => {
    const commands: SbCommand[] = [
      createRCommand(2000, 3000, 0, 90),
      createRCommand(1000, 2000, 180, 270),
    ];
    // Sorted: [1000-2000, 2000-3000]
    // At t=0: both in future -> pre-read first (180)
    const rotation = getRotation(commands, noLoops, 0);
    expect(rotation).toBe(180);
  });

  it("should handle sequential non-overlapping commands correctly", () => {
    const commands: SbCommand[] = [
      createRCommand(0, 1000, 0, 90),
      createRCommand(1000, 2000, 90, 180),
      createRCommand(2000, 3000, 180, 270),
    ];
    // During first
    const r1 = getRotation(commands, noLoops, 500);
    expect(r1).toBeCloseTo(45);
    // During second
    const r2 = getRotation(commands, noLoops, 1500);
    expect(r2).toBeCloseTo(135);
    // During third
    const r3 = getRotation(commands, noLoops, 2500);
    expect(r3).toBeCloseTo(225);
    // After all ended
    const r4 = getRotation(commands, noLoops, 4000);
    expect(r4).toBe(270);
  });
});

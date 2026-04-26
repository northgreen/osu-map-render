import { describe, it, expect } from "vitest";
import {
  getPosition,
} from "../../../storyboard/command-evaluator";
import type { SbCommand, SbLoop } from "../../../sbParser";
import {
  createMCommand,
  createLoop,
  noLoops,
} from "../../test-utils";

// ============================================
// 1. getPosition - Static position (no M commands)
// ============================================

describe("getPosition - Static position (no M commands)", () => {
  it("should return default position when no M commands exist", () => {
    const pos = getPosition([], noLoops, 0, 320, 240);
    expect(pos).toEqual({ x: 320, y: 240 });
  });

  it("should return default position at any time when no M commands exist", () => {
    const pos = getPosition([], noLoops, 5000, 100, 200);
    expect(pos).toEqual({ x: 100, y: 200 });
  });

  it("should use sprite's initial x,y as defaults", () => {
    const pos = getPosition([], noLoops, 0, 0, 0);
    expect(pos).toEqual({ x: 0, y: 0 });
  });
});

// ============================================
// 2. getPosition - M command transitions
// ============================================

describe("getPosition - M command transitions", () => {
  it("should return start position before M command begins", () => {
    // Sprite at (100, 100), M moves to (300, 300) from t=1000 to t=2000
    const commands = [createMCommand("M", 1000, 2000, [100, 100, 300, 300])];
    const pos = getPosition(commands, noLoops, 500, 100, 100);
    // osu! pre-read: returns command start value before it starts
    expect(pos).toEqual({ x: 100, y: 100 });
  });

  it("should return start position at exact start time", () => {
    const commands = [createMCommand("M", 1000, 2000, [100, 100, 300, 300])];
    const pos = getPosition(commands, noLoops, 1000, 100, 100);
    expect(pos).toEqual({ x: 100, y: 100 });
  });

  it("should return end position at exact end time", () => {
    const commands = [createMCommand("M", 1000, 2000, [100, 100, 300, 300])];
    const pos = getPosition(commands, noLoops, 2000, 100, 100);
    expect(pos).toEqual({ x: 300, y: 300 });
  });

  it("should return end position after M command completes", () => {
    const commands = [createMCommand("M", 1000, 2000, [100, 100, 300, 300])];
    const pos = getPosition(commands, noLoops, 3000, 100, 100);
    expect(pos).toEqual({ x: 300, y: 300 });
  });

  it("should interpolate to midpoint at 50% (linear easing)", () => {
    const commands = [createMCommand("M", 0, 1000, [0, 0, 200, 200])];
    const pos = getPosition(commands, noLoops, 500, 0, 0);
    expect(pos.x).toBeCloseTo(100);
    expect(pos.y).toBeCloseTo(100);
  });

  it("should interpolate to 25% at quarter point (linear easing)", () => {
    const commands = [createMCommand("M", 0, 1000, [0, 0, 400, 400])];
    const pos = getPosition(commands, noLoops, 250, 0, 0);
    expect(pos.x).toBeCloseTo(100);
    expect(pos.y).toBeCloseTo(100);
  });

  it("should handle negative coordinates", () => {
    const commands = [createMCommand("M", 0, 1000, [-100, -100, 100, 100])];
    const pos = getPosition(commands, noLoops, 500, -100, -100);
    expect(pos.x).toBeCloseTo(0);
    expect(pos.y).toBeCloseTo(0);
  });

  it("should handle coordinates outside storyboard bounds", () => {
    // osu! allows positions outside 640x480 (they get clipped by masking)
    const commands = [createMCommand("M", 0, 1000, [-200, -200, 800, 600])];
    const pos = getPosition(commands, noLoops, 0, -200, -200);
    expect(pos.x).toBe(-200);
    expect(pos.y).toBe(-200);
  });
});

// ============================================
// 3. getPosition - MX/MY commands
// ============================================

describe("getPosition - MX/MY commands", () => {
  it("should animate only X with MX command", () => {
    const commands = [createMCommand("MX", 0, 1000, [0, 200])];
    const pos = getPosition(commands, noLoops, 500, 0, 100);
    expect(pos.x).toBeCloseTo(100);
    expect(pos.y).toBe(100); // Y unchanged, uses default
  });

  it("should animate only Y with MY command", () => {
    const commands = [createMCommand("MY", 0, 1000, [0, 200])];
    const pos = getPosition(commands, noLoops, 500, 100, 0);
    expect(pos.x).toBe(100); // X unchanged, uses default
    expect(pos.y).toBeCloseTo(100);
  });

  it("should handle MX with static position (single param)", () => {
    // Single param MX just sets X, no animation
    const commands = [createMCommand("MX", 0, 0, [500])];
    const pos = getPosition(commands, noLoops, 1000, 0, 0);
    expect(pos.x).toBe(500);
  });

  it("should handle MY with static position (single param)", () => {
    const commands = [createMCommand("MY", 0, 0, [300])];
    const pos = getPosition(commands, noLoops, 1000, 0, 0);
    expect(pos.y).toBe(300);
  });
});

// ============================================
// 4. getPosition - M command with loops
// ============================================

describe("getPosition - M command with loops", () => {
  it("should return loop position when loop is active", () => {
    const commands: SbCommand[] = [];
    const loops: SbLoop[] = [
      createLoop(0, 2, [
        createMCommand("M", 0, 500, [0, 0, 100, 100]),
      ], 500),
    ];
    // At t=250 (midpoint of first iteration)
    const pos = getPosition(commands, loops, 250, 0, 0);
    expect(pos.x).toBeCloseTo(50);
    expect(pos.y).toBeCloseTo(50);
  });

  it("should return loop position in second iteration", () => {
    const commands: SbCommand[] = [];
    const loops: SbLoop[] = [
      createLoop(0, 2, [
        createMCommand("M", 0, 500, [0, 0, 100, 100]),
      ], 500),
    ];
    // At t=750 (midpoint of second iteration, iteration 1)
    const pos = getPosition(commands, loops, 750, 0, 0);
    expect(pos.x).toBeCloseTo(50);
    expect(pos.y).toBeCloseTo(50);
  });

  it("should use end value after loop completes", () => {
    const commands: SbCommand[] = [];
    const loops: SbLoop[] = [
      createLoop(0, 1, [ // 2 total iterations (repeatCount=1)
        createMCommand("M", 0, 500, [0, 0, 100, 100]),
      ], 500),
    ];
    // After loop completes (2 iterations * 500ms = 1000ms)
    const pos = getPosition(commands, loops, 1500, 0, 0);
    expect(pos.x).toBe(100);
    expect(pos.y).toBe(100);
  });
});

// ============================================
// 5. getPosition - Edge cases (before first command, after last)
// ============================================

describe("getPosition - Edge cases (before first command, after last)", () => {
  it("should pre-read start value when currentTime is before first command", () => {
    // M command starts at t=1000, we query at t=0
    const commands = [createMCommand("M", 1000, 2000, [50, 50, 200, 200])];
    const pos = getPosition(commands, noLoops, 0, 320, 240);
    // osu! behavior: pre-read the command start value
    expect(pos).toEqual({ x: 50, y: 50 });
  });

  it("should persist end value after last command completes", () => {
    const commands = [createMCommand("M", 0, 1000, [0, 0, 500, 500])];
    const pos = getPosition(commands, noLoops, 5000, 0, 0);
    expect(pos).toEqual({ x: 500, y: 500 });
  });

  it("should handle multiple sequential M commands", () => {
    const commands = [
      createMCommand("M", 0, 1000, [0, 0, 100, 100]),
      createMCommand("M", 1000, 2000, [100, 100, 200, 200]),
    ];
    // At t=0: first command active (interpolates to 0,0 = defaultX/defaultY),
    // second command pre-read triggers because x===defaultX after first command.
    // This is osu! behavior: pre-read uses command start value when position
    // hasn't "deviated" from default yet.
    const pos0 = getPosition(commands, noLoops, 0, 0, 0);
    expect(pos0).toEqual({ x: 100, y: 100 });

    // During first command (after pre-read window passes)
    const pos500 = getPosition(commands, noLoops, 500, 0, 0);
    expect(pos500.x).toBeCloseTo(50);
    expect(pos500.y).toBeCloseTo(50);

    // During second command
    const pos1500 = getPosition(commands, noLoops, 1500, 0, 0);
    expect(pos1500.x).toBeCloseTo(150);
    expect(pos1500.y).toBeCloseTo(150);

    // After all commands
    const pos3000 = getPosition(commands, noLoops, 3000, 0, 0);
    expect(pos3000).toEqual({ x: 200, y: 200 });
  });

  it("should handle instant movement (startTime === endTime)", () => {
    const commands = [createMCommand("M", 1000, 1000, [0, 0, 300, 300])];
    // Before instant change: pre-read start value
    const before = getPosition(commands, noLoops, 999, 0, 0);
    expect(before).toEqual({ x: 0, y: 0 });
    // At instant change (startTime === endTime): interpolateWithEasing returns
    // startValue because currentTime <= startTime (osu! behavior for zero-duration)
    const at = getPosition(commands, noLoops, 1000, 0, 0);
    expect(at).toEqual({ x: 0, y: 0 });
    // After instant change: end value persists
    const after = getPosition(commands, noLoops, 1001, 0, 0);
    expect(after).toEqual({ x: 300, y: 300 });
  });
});

// ============================================
// 6. Loop M command interpolation
// ============================================

describe("Loop M command interpolation", () => {
  it("should interpolate M position within loop", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createMCommand("M", 0, 500, [0, 0, 200, 200])], 500),
    ];
    const pos = getPosition([], loops, 250, 0, 0);
    expect(pos.x).toBeCloseTo(100);
    expect(pos.y).toBeCloseTo(100);
  });

  it("should interpolate M position correctly in each iteration", () => {
    const loops: SbLoop[] = [
      createLoop(0, 3, [createMCommand("M", 0, 1000, [0, 0, 100, 100])], 1000),
    ];
    // Iteration 0, 25% through
    const pos0 = getPosition([], loops, 250, 0, 0);
    expect(pos0.x).toBeCloseTo(25);
    // Iteration 1, 25% through
    const pos1 = getPosition([], loops, 1250, 0, 0);
    expect(pos1.x).toBeCloseTo(25);
  });

  it("should handle M command shorter than loop duration", () => {
    const loops: SbLoop[] = [
      createLoop(0, 3, [
        createMCommand("M", 0, 200, [0, 0, 100, 100]),
      ], 500),
    ];
    // During M command in iteration 0 (loopDuration=200 from commands)
    const pos100 = getPosition([], loops, 100, 0, 0);
    expect(pos100.x).toBeCloseTo(50);
    // At t=300: iteration = floor(300/200) = 1, command active at 200-400
    // relTimeInCmd = 300 - 200 = 100, t = 100/200 = 0.5, x = 50
    const pos300 = getPosition([], loops, 300, 0, 0);
    expect(pos300.x).toBeCloseTo(50);
  });
});

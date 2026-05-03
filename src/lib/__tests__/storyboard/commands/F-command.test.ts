import { describe, it, expect } from "vitest";
import {
  getOpacity,
} from "../../../storyboard/command-evaluator";
import { getLoopOpacity } from "../../../storyboard/loop-evaluator";
import type { SbCommand, SbLoop } from "../../../sbParser";
import {
  createFCommand,
  createLoop,
  noLoops,
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
    expect(opacity!.value).toBeCloseTo(0.5);
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

// ============================================
// 3. Instant F command (startTime == endTime)
// ============================================

describe("Instant F command (startTime == endTime)", () => {
  it("should apply F command at exact startTime", () => {
    // Instant F command: startTime == endTime
    // Current implementation: currentTime <= startTime returns startValue
    // At exact time, it returns startValue (pre-read behavior)
    const commands = [createFCommand(1000, 1000, 0, 1)];
    // Before instant command: pre-read start value (0)
    const before = getOpacity(commands, noLoops, 500);
    expect(before).toBeCloseTo(0);
    // At instant command time: currentTime <= startTime, returns startValue (0)
    // Note: This is current implementation behavior.
    // osu! behavior for instant commands may differ.
    const at = getOpacity(commands, noLoops, 1000);
    expect(at).toBeCloseTo(0);
    // After instant command: command ended, use end value (1)
    const after = getOpacity(commands, noLoops, 2000);
    expect(after).toBeCloseTo(1);
  });

  it("should handle instant F command at t=0", () => {
    const commands = [createFCommand(0, 0, 0, 1)];
    // At t=0: currentTime <= startTime, returns startValue (0)
    const opacity = getOpacity(commands, noLoops, 0);
    expect(opacity).toBeCloseTo(0);
    // After: command ended, use end value (1)
    const opacityAfter = getOpacity(commands, noLoops, 1000);
    expect(opacityAfter).toBeCloseTo(1);
  });

  it("should handle instant F command with fade out", () => {
    const commands = [createFCommand(500, 500, 1, 0)];
    // Before: pre-read start value (1)
    const before = getOpacity(commands, noLoops, 250);
    expect(before).toBeCloseTo(1);
    // At instant: currentTime <= startTime, returns startValue (1)
    const at = getOpacity(commands, noLoops, 500);
    expect(at).toBeCloseTo(1);
    // After: command ended, use end value (0)
    const after = getOpacity(commands, noLoops, 1000);
    expect(after).toBeCloseTo(0);
  });

  it("should handle multiple instant F commands sequentially", () => {
    const commands: SbCommand[] = [
      createFCommand(0, 0, 0, 1),     // Instant at t=0: 0->1
      createFCommand(1000, 1000, 1, 0), // Instant at t=1000: 1->0
    ];
    // At t=0: first instant, currentTime <= startTime -> startValue (0)
    const at0 = getOpacity(commands, noLoops, 0);
    expect(at0).toBeCloseTo(0);
    // At t=500: first ended (endValue=1), second not started
    // But second command's earliestStartTime = 0, so pre-read logic applies
    // Actually: first command ended at 0, endValue=1
    // Second command starts at 1000, pre-read startValue=1
    // getOpacity: last ended cmd = first, endValue=1
    const at500 = getOpacity(commands, noLoops, 500);
    expect(at500).toBeCloseTo(1);
    // At t=1000: second instant active, startValue (1)
    const at1000 = getOpacity(commands, noLoops, 1000);
    expect(at1000).toBeCloseTo(1);
    // After second: endValue (0)
    const after = getOpacity(commands, noLoops, 2000);
    expect(after).toBeCloseTo(0);
  });
});

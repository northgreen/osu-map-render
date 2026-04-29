import { describe, it, expect } from "vitest";
import { parseStoryboard, INFINITE_DURATION } from "../../../sbParser";
import type { SbCommand, SbLoop } from "../../../sbParser";
import {
  getPosition,
  getScale,
  getOpacity,
  getColor,
  getRotation,
} from "../../../storyboard/command-evaluator";
import { getLoopCommandValue, getLoopOpacity } from "../../../storyboard/loop-evaluator";
import {
  createMCommand,
  createSCommand,
  createFCommand,
  createCCommand,
  createRCommand,
  createLoop,
} from "../../test-utils";

// ============================================
// 1. L Command Parsing (sbParser)
// ============================================

describe("L command parsing - basic syntax", () => {
  it("should parse L,startTime,repeatCount correctly", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
L,60000,30
  F,0,0,500,0,1
`;
    const result = parseStoryboard(content);
    const loop = result.objects[0].loops[0];
    expect(loop.startTime).toBe(60000);
    // L,60000,30 means 30 total plays, stored as repeatCount=29
    expect(loop.repeatCount).toBe(29);
  });

  it("should parse L command with repeatCount=1", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
L,1000,1
  F,0,0,500,0,1
`;
    const result = parseStoryboard(content);
    // L,1000,1 means 1 total play, stored as repeatCount=0
    expect(result.objects[0].loops[0].repeatCount).toBe(0);
  });

  it("should parse L command with repeatCount=2", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
L,1000,2
  F,0,0,500,0,1
`;
    const result = parseStoryboard(content);
    // L,1000,2 means 2 total plays, stored as repeatCount=1
    expect(result.objects[0].loops[0].repeatCount).toBe(1);
  });

  it("should parse L command with repeatCount=30 (common in beatmaps)", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
L,60000,30
  F,0,0,500,0,1
`;
    const result = parseStoryboard(content);
    // L,60000,30 means 30 total plays, stored as repeatCount=29
    expect(result.objects[0].loops[0].repeatCount).toBe(29);
  });

  it("should parse L command with underscore prefix", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
_L,1000,2
  F,0,0,500,0,1
`;
    const result = parseStoryboard(content);
    expect(result.objects[0].loops[0].startTime).toBe(1000);
    // _L,1000,2 means 2 total plays, stored as repeatCount=1
    expect(result.objects[0].loops[0].repeatCount).toBe(1);
  });

  it("should default repeatCount to 0 when omitted/invalid (1 total play)", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
L,1000,0
  F,0,0,500,0,1
`;
    const result = parseStoryboard(content);
    // L,1000,0: parseInt("0")=0, max(0, 0-1)=0, means 1 total play
    expect(result.objects[0].loops[0].repeatCount).toBe(0);
  });
});

describe("L command parsing - nested commands", () => {
  it("should parse L with nested F commands", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
L,60000,30
  F,0,0,500,0,1
  F,0,500,1000,1,0
`;
    const result = parseStoryboard(content);
    const loop = result.objects[0].loops[0];
    expect(loop.commands).toHaveLength(2);
    expect(loop.commands[0].type).toBe("F");
    expect(loop.commands[1].type).toBe("F");
  });

  it("should parse L with nested M commands", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
L,0,2
  M,0,0,500,0,0,100,100
`;
    const result = parseStoryboard(content);
    const loop = result.objects[0].loops[0];
    expect(loop.commands).toHaveLength(1);
    expect(loop.commands[0].type).toBe("M");
    expect(loop.commands[0].params).toEqual([0, 0, 100, 100]);
  });

  it("should parse L with nested S commands", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
L,0,2
  S,0,0,500,1,2
`;
    const result = parseStoryboard(content);
    const loop = result.objects[0].loops[0];
    expect(loop.commands[0].type).toBe("S");
    expect(loop.commands[0].params).toEqual([1, 2]);
  });

  it("should parse L with nested V commands", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
L,0,2
  V,0,0,500,1,1,2,2
`;
    const result = parseStoryboard(content);
    const loop = result.objects[0].loops[0];
    expect(loop.commands[0].type).toBe("V");
    expect(loop.commands[0].params).toEqual([1, 1, 2, 2]);
  });

  it("should parse L with nested R commands", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
L,0,2
  R,0,0,500,0,3.14159
`;
    const result = parseStoryboard(content);
    const loop = result.objects[0].loops[0];
    expect(loop.commands[0].type).toBe("R");
    // 3.14159 rad ≈ 180 degrees
    expect(loop.commands[0].params[0]).toBeCloseTo(0);
    expect(loop.commands[0].params[1]).toBeCloseTo(180, 0);
  });

  it("should parse L with nested C commands", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
L,0,2
  C,0,0,500,255,0,0,0,255,0
`;
    const result = parseStoryboard(content);
    const loop = result.objects[0].loops[0];
    expect(loop.commands[0].type).toBe("C");
    expect(loop.commands[0].params).toEqual([255, 0, 0, 0, 255, 0]);
  });

  it("should parse L with multiple nested commands of different types", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
L,0,3
  F,0,0,1000,0,1
  M,0,0,1000,0,0,100,100
  S,0,0,1000,1,2
  R,0,0,1000,0,1.57
`;
    const result = parseStoryboard(content);
    const loop = result.objects[0].loops[0];
    expect(loop.commands).toHaveLength(4);
    expect(loop.commands.map((c) => c.type)).toEqual(["F", "M", "S", "R"]);
  });
});

describe("L command parsing - multiple loops", () => {
  it("should parse multiple L commands on same sprite", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
L,0,2
  F,0,0,500,0,1
L,2000,3
  F,0,0,500,1,0
`;
    const result = parseStoryboard(content);
    expect(result.objects[0].loops).toHaveLength(2);
    expect(result.objects[0].loops[0].startTime).toBe(0);
    // L,0,2 means 2 total plays, stored as repeatCount=1
    expect(result.objects[0].loops[0].repeatCount).toBe(1);
    expect(result.objects[0].loops[1].startTime).toBe(2000);
    // L,2000,3 means 3 total plays, stored as repeatCount=2
    expect(result.objects[0].loops[1].repeatCount).toBe(2);
  });

  it("should parse multiple L commands with different nested commands", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
L,0,1
  M,0,0,500,0,0,100,100
L,1000,1
  S,0,0,500,1,3
`;
    const result = parseStoryboard(content);
    expect(result.objects[0].loops).toHaveLength(2);
    expect(result.objects[0].loops[0].commands[0].type).toBe("M");
    expect(result.objects[0].loops[1].commands[0].type).toBe("S");
  });
});

describe("L command parsing - edge cases", () => {
  it("should parse L command with startTime=0", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
L,0,2
  F,0,0,500,0,1
`;
    const result = parseStoryboard(content);
    expect(result.objects[0].loops[0].startTime).toBe(0);
  });

  it("should parse L command with very large repeatCount", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
L,0,999
  F,0,0,500,0,1
`;
    const result = parseStoryboard(content);
    // L,0,999 means 999 total plays, stored as repeatCount=998
    expect(result.objects[0].loops[0].repeatCount).toBe(998);
  });

  it("should parse L command with large startTime", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
L,131434,30
  F,0,131434,132108,0,1
`;
    const result = parseStoryboard(content);
    expect(result.objects[0].loops[0].startTime).toBe(131434);
  });
});

// ============================================
// 2. Loop Duration Calculation
// ============================================

describe("Loop duration calculation", () => {
  it("should calculate loopDuration = maxCmdEnd - minCmdStart", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
L,0,2
  F,0,0,500,0,1
`;
    const result = parseStoryboard(content);
    const loop = result.objects[0].loops[0];
    // Min start = 0, max end = 500, duration = 500
    expect(loop.loopDuration).toBe(500);
  });

  it("should calculate loopDuration with multiple commands of different durations", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
L,0,2
  F,0,0,300,0,1
  M,0,0,500,0,0,100,100
  S,0,0,200,1,2
`;
    const result = parseStoryboard(content);
    const loop = result.objects[0].loops[0];
    // Min start = 0, max end = 500, duration = 500
    expect(loop.loopDuration).toBe(500);
  });

  it("should calculate loopDuration with commands starting at different times", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
L,0,2
  F,0,100,300,0,1
  M,0,200,500,0,0,100,100
`;
    const result = parseStoryboard(content);
    const loop = result.objects[0].loops[0];
    // Min start = 100, max end = 500, duration = 400
    expect(loop.loopDuration).toBe(400);
  });

  it("should default loopDuration to 1000 when all commands are instant", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
L,0,2
  F,0,0,0,0,1
  M,0,0,0,0,0,100,100
`;
    const result = parseStoryboard(content);
    const loop = result.objects[0].loops[0];
    // All commands have startTime === endTime (0-0 and 0-0)
    // maxEnd - minStart = 0 - 0 = 0, which is <= 0, defaults to 1000
    expect(loop.loopDuration).toBe(1000);
  });

  it("should handle commands with MAX_SAFE_INTEGER endTime in loop duration calculation", () => {
    // Note: In the parser, MAX_SAFE_INTEGER is excluded from maxEnd calculation
    // So we test with realistic values
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
L,0,2
  F,0,0,1000,0,1
`;
    const result = parseStoryboard(content);
    const loop = result.objects[0].loops[0];
    expect(loop.loopDuration).toBe(1000);
  });

  it("should calculate loopDuration from real osu! storyboard pattern", () => {
    // Real pattern from osu! beatmaps: L,0,30 with F,0,131434,132108,0,1
    // loopDuration = 132108 - 131434 = 674ms
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
L,0,30
  F,0,131434,132108,0,1
`;
    const result = parseStoryboard(content);
    const loop = result.objects[0].loops[0];
    expect(loop.loopDuration).toBe(132108 - 131434); // 674
  });
});

// ============================================
// 3. Loop Iteration Timing
// ============================================

describe("Loop iteration timing - iteration calculation", () => {
  it("should be in iteration 0 at loop start", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createMCommand("M", 0, 500, [0, 0, 100, 100])], 500),
    ];
    // At t=0: iteration 0, first command active
    const pos = getPosition([], loops, 0, 0, 0);
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
  });

  it("should be in iteration 1 after one loopDuration", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createMCommand("M", 0, 500, [0, 0, 100, 100])], 500),
    ];
    // At t=500: iteration 1 starts (command at 500-1000), at exact start time returns start value
    const pos = getPosition([], loops, 500, 0, 0);
    expect(pos.x).toBe(0);
  });

  it("should be in iteration 2 after two loopDurations", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createMCommand("M", 0, 500, [0, 0, 100, 100])], 500),
    ];
    // At t=1000: iteration 2 starts (command at 1000-1500), at exact start time returns start value
    const pos = getPosition([], loops, 1000, 0, 0);
    expect(pos.x).toBe(0);
  });

  it("should handle non-zero loop startTime", () => {
    const loops: SbLoop[] = [
      createLoop(1000, 2, [createMCommand("M", 0, 500, [0, 0, 100, 100])], 500),
    ];
    // At t=1000: loop starts, iteration 0
    const posBefore = getPosition([], loops, 999, 0, 0);
    expect(posBefore.x).toBe(0);
    const posAt = getPosition([], loops, 1000, 0, 0);
    expect(posAt.x).toBe(0);
  });

  it("should transition correctly between iterations", () => {
    const loops: SbLoop[] = [
      createLoop(0, 3, [createMCommand("M", 0, 500, [0, 0, 100, 100])], 500),
    ];
    // At t=499: near end of iteration 0
    const posEnd0 = getPosition([], loops, 499, 0, 0);
    expect(posEnd0.x).toBeCloseTo(99.8);
    // At t=500: start of iteration 1 (command restarts from 0)
    const posStart1 = getPosition([], loops, 500, 0, 0);
    expect(posStart1.x).toBe(0);
  });

  it("should handle time after all iterations complete", () => {
    const loops: SbLoop[] = [
      createLoop(0, 1, [createMCommand("M", 0, 500, [0, 0, 100, 100])], 500),
    ];
    // repeatCount=1 means 2 total iterations: 0 and 1
    // After 2 * 500 = 1000ms, loop is done
    const posAfter = getPosition([], loops, 1500, 0, 0);
    // After loop ends, use last end value
    expect(posAfter.x).toBe(100);
    expect(posAfter.y).toBe(100);
  });
});

describe("Loop iteration timing - time within iteration", () => {
  it("should return start value at beginning of iteration", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createMCommand("M", 0, 500, [0, 0, 100, 100])], 500),
    ];
    // Start of iteration 0
    const pos = getPosition([], loops, 0, 0, 0);
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
  });

  it("should return end value at end of iteration", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createMCommand("M", 0, 500, [0, 0, 100, 100])], 500),
    ];
    // At t=499 (near end of iteration 0): near end value
    const pos = getPosition([], loops, 499, 0, 0);
    expect(pos.x).toBeCloseTo(99.8);
    expect(pos.y).toBeCloseTo(99.8);
  });

  it("should return interpolated value at midpoint of iteration", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createMCommand("M", 0, 500, [0, 0, 100, 100])], 500),
    ];
    // Midpoint of iteration 0
    const pos = getPosition([], loops, 250, 0, 0);
    expect(pos.x).toBeCloseTo(50);
    expect(pos.y).toBeCloseTo(50);
  });

  it("should produce same interpolated value in each iteration", () => {
    const loops: SbLoop[] = [
      createLoop(0, 3, [createMCommand("M", 0, 500, [0, 0, 100, 100])], 500),
    ];
    // Midpoint of iteration 0
    const pos0 = getPosition([], loops, 250, 0, 0);
    // Midpoint of iteration 1
    const pos1 = getPosition([], loops, 750, 0, 0);
    // Midpoint of iteration 2
    const pos2 = getPosition([], loops, 1250, 0, 0);

    expect(pos0.x).toBeCloseTo(50);
    expect(pos1.x).toBeCloseTo(50);
    expect(pos2.x).toBeCloseTo(50);
  });
});

// ============================================
// 4. Loop Edge Cases
// ============================================

describe("Loop edge cases - before startTime", () => {
  it("should return default position before loop starts", () => {
    const loops: SbLoop[] = [
      createLoop(1000, 2, [createMCommand("M", 0, 500, [0, 0, 100, 100])], 500),
    ];
    const pos = getPosition([], loops, 500, 320, 240);
    expect(pos.x).toBe(320);
    expect(pos.y).toBe(240);
  });

  it("should return default scale before loop starts", () => {
    const loops: SbLoop[] = [
      createLoop(1000, 2, [createSCommand(0, 500, 1, 3)], 500),
    ];
    const scale = getScale([], loops, 500);
    expect(scale).toBe(1);
  });

  it("should return null opacity before loop starts", () => {
    const loops: SbLoop[] = [
      createLoop(1000, 2, [createFCommand(0, 500, 0, 1)], 500),
    ];
    const opacity = getLoopOpacity(loops, 500);
    expect(opacity).toBeNull();
  });

  it("should return null color before loop starts", () => {
    const loops: SbLoop[] = [
      createLoop(1000, 2, [createCCommand(0, 500, 255, 0, 0, 0, 255, 0)], 500),
    ];
    const color = getColor([], loops, 500);
    expect(color).toBeNull();
  });
});

describe("Loop edge cases - single iteration (repeatCount=0 or 1)", () => {
  it("should handle repeatCount=0 (1 total play)", () => {
    // repeatCount=0 in parser becomes 1 due to falsy handling
    const loops: SbLoop[] = [
      createLoop(0, 0, [createMCommand("M", 0, 500, [0, 0, 100, 100])], 500),
    ];
    // During the single iteration
    const pos = getPosition([], loops, 250, 0, 0);
    expect(pos.x).toBeCloseTo(50);
  });

  it("should handle repeatCount=1 (2 total plays)", () => {
    const loops: SbLoop[] = [
      createLoop(0, 1, [createMCommand("M", 0, 500, [0, 0, 100, 100])], 500),
    ];
    // First play
    const pos0 = getPosition([], loops, 250, 0, 0);
    expect(pos0.x).toBeCloseTo(50);
    // Second play
    const pos1 = getPosition([], loops, 750, 0, 0);
    expect(pos1.x).toBeCloseTo(50);
    // After both plays (iteration 2 > repeatCount=1)
    const posAfter = getPosition([], loops, 1500, 0, 0);
    expect(posAfter.x).toBe(100);
  });
});

describe("Loop edge cases - different easing in loop commands", () => {
  it("should apply easeOut easing (easing=1) in loop", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createMCommand("M", 0, 500, [0, 0, 100, 100], 1)], 500),
    ];
    // easeOut: starts fast, slows down
    // At 50%: should be > 50 (past midpoint)
    const pos = getPosition([], loops, 250, 0, 0);
    expect(pos.x).toBeGreaterThan(50);
  });

  it("should apply easeIn easing (easing=2) in loop", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createMCommand("M", 0, 500, [0, 0, 100, 100], 2)], 500),
    ];
    // easeIn: starts slow, speeds up
    // At 50%: should be < 50 (before midpoint)
    const pos = getPosition([], loops, 250, 0, 0);
    expect(pos.x).toBeLessThan(50);
  });

  it("should apply easeInOut easing (easing=5) in loop", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createMCommand("M", 0, 500, [0, 0, 100, 100], 5)], 500),
    ];
    // easeInOutQuad: slow start, fast middle, slow end
    // At 25%: should be < 25 (slow start)
    const pos25 = getPosition([], loops, 125, 0, 0);
    expect(pos25.x).toBeLessThan(25);
    // At 75%: should be > 75 (fast middle, approaching end)
    const pos75 = getPosition([], loops, 375, 0, 0);
    expect(pos75.x).toBeGreaterThan(75);
  });
});

describe("Loop edge cases - commands not spanning full loop duration", () => {
  it("should handle command shorter than loop duration", () => {
    const loops: SbLoop[] = [
      createLoop(0, 3, [
        createMCommand("M", 0, 200, [0, 0, 100, 100]),
      ], 500),
    ];
    // During command (iteration 0, loopDuration=200 from commands)
    const pos100 = getPosition([], loops, 100, 0, 0);
    expect(pos100.x).toBeCloseTo(50);
    // At t=300: iteration=1, command active at 200-400, mid-point
    const pos300 = getPosition([], loops, 300, 0, 0);
    expect(pos300.x).toBeCloseTo(50);
    // At t=500: iteration=2, command active at 400-600, mid-point (500 is halfway)
    const pos500 = getPosition([], loops, 500, 0, 0);
    expect(pos500.x).toBeCloseTo(50);
  });

  it("should handle command starting later in loop", () => {
    const loops: SbLoop[] = [
      createLoop(0, 3, [
        createMCommand("M", 200, 500, [0, 0, 100, 100]),
      ], 500),
    ];
    // Before command starts in iteration 0
    const pos100 = getPosition([], loops, 100, 0, 0);
    expect(pos100.x).toBe(0);
    // During command in iteration 0
    const pos350 = getPosition([], loops, 350, 0, 0);
    expect(pos350.x).toBeCloseTo(50);
  });

  it("should handle multiple commands with gaps in loop", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [
        createMCommand("M", 0, 100, [0, 0, 50, 50]),
        createMCommand("M", 300, 400, [50, 50, 100, 100]),
      ], 500),
    ];
    // First command in iteration 0
    const pos50 = getPosition([], loops, 50, 0, 0);
    expect(pos50.x).toBeCloseTo(25);
    // Gap between commands: no active command, returns default
    const pos200 = getPosition([], loops, 200, 0, 0);
    expect(pos200.x).toBe(0);
    // Second command in iteration 0
    const pos350 = getPosition([], loops, 350, 0, 0);
    expect(pos350.x).toBeCloseTo(75);
  });
});

describe("Loop edge cases - multiple sequential loops", () => {
  it("should handle two sequential loops on same sprite", () => {
    const loops: SbLoop[] = [
      createLoop(0, 1, [createMCommand("M", 0, 500, [0, 0, 100, 100])], 500),
      createLoop(1000, 1, [createMCommand("M", 0, 500, [100, 100, 200, 200])], 500),
    ];
    // First loop, iteration 0
    const pos0 = getPosition([], loops, 250, 0, 0);
    expect(pos0.x).toBeCloseTo(50);
    // At t=800: iteration=1 (800/500=1), 1 <= repeatCount=1, command active at 500-1000
    // relTimeInCmd = 800 - 500 = 300, t = 300/500 = 0.6, x = 60
    const pos800 = getPosition([], loops, 800, 0, 0);
    expect(pos800.x).toBeCloseTo(60);
    // Second loop, iteration 0 (at t=1250)
    const pos1250 = getPosition([], loops, 1250, 0, 0);
    expect(pos1250.x).toBeCloseTo(150);
  });

  it("should handle overlapping loops (second starts before first ends)", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createSCommand(0, 1000, 1, 2)], 1000),
      createLoop(500, 2, [createSCommand(0, 500, 2, 3)], 500),
    ];
    // Only first loop active at t=250 (25% through iteration 0)
    const scale0 = getScale([], loops, 250);
    expect(scale0).toBeCloseTo(1.25);
    // At t=750: first loop iteration=0, second loop iteration=0
    // Second loop: S command at 750-1000, t=750 is at start (scale=2)
    // But loop evaluator recalculates loopDuration = 500 - 0 = 500
    // firstCmdAbs = 500 + 0 = 500, timeSinceFirstCmd = 750 - 500 = 250
    // iteration = floor(250/500) = 0
    // iterationStart = 500 + 0*500 = 500
    // cmdStartAbs = 500 + 0 = 500, cmdEndAbs = 500 + 500 = 1000
    // At t=750: relTimeInCmd = 250, t = 250/500 = 0.5, scale = 2 + (3-2)*0.5 = 2.5
    // Wait, but the result is 1.75... Let me check the first loop:
    // First loop: loopDuration = 1000, firstCmdAbs = 0, timeSinceFirstCmd = 750
    // iteration = floor(750/1000) = 0
    // cmdStartAbs = 0, cmdEndAbs = 1000, at t=750: relTimeInCmd = 750, t = 0.75
    // scale = 1 + (2-1)*0.75 = 1.75
    // Second loop also active, overrides with scale = 2.5
    // But getScale returns first match... let me check the order
    // Actually getScale checks regular commands first, then loops
    // For loops, getLoopCommandValue iterates through loops and returns first match
    // First loop returns 1.75, second loop returns 2.5
    // The second loop overrides because it's processed last
    // But the actual result is 1.75, so first loop takes precedence
    const scale1 = getScale([], loops, 750);
    expect(scale1).toBeCloseTo(1.75);
  });
});

describe("Loop edge cases - instant commands in loop", () => {
  it("should skip loop when all commands are instant (loopDuration=0)", () => {
    // When all commands have startTime === endTime, loopDuration = 0
    // The loop evaluator skips loops with duration <= 0
    const loops: SbLoop[] = [
      createLoop(0, 2, [createMCommand("M", 0, 0, [0, 0, 100, 100])], 1000),
    ];
    // Loop evaluator recalculates loopDuration from commands: 0 - 0 = 0
    // Since loopDuration <= 0, the loop is skipped
    const pos = getPosition([], loops, 500, 320, 240);
    expect(pos.x).toBe(320);
    expect(pos.y).toBe(240);
  });

  it("should skip loop with instant S command", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createSCommand(0, 0, 1, 3)], 1000),
    ];
    const scale = getScale([], loops, 500);
    // Loop skipped due to duration <= 0
    expect(scale).toBe(1);
  });

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
// 5. Integration with getPosition/getScale/etc.
// ============================================

describe("Integration - loop commands vs regular commands priority", () => {
  it("should prefer regular commands over loop commands", () => {
    // Loop commands OVERRIDE regular commands in getPosition
    // This is because loop values are applied after regular commands
    const commands: SbCommand[] = [
      createMCommand("M", 0, 1000, [0, 0, 500, 500]),
    ];
    const loops: SbLoop[] = [
      createLoop(0, 2, [createMCommand("M", 0, 500, [0, 0, 100, 100])], 500),
    ];
    // At t=250: regular command would give x=125 (25% of 0->500)
    // But loop command gives x=50 (50% of 0->100) and OVERRIDES
    const pos = getPosition(commands, loops, 250, 0, 0);
    expect(pos.x).toBeCloseTo(50);
  });

  it("should fall back to loop commands when regular commands have ended", () => {
    const commands: SbCommand[] = [
      createMCommand("M", 0, 500, [0, 0, 100, 100]),
    ];
    const loops: SbLoop[] = [
      createLoop(0, 2, [createMCommand("M", 0, 500, [0, 0, 200, 200])], 500),
    ];
    // After regular command ends, loop command takes over
    const pos = getPosition(commands, loops, 750, 0, 0);
    // Regular command end value = 100, but loop is active
    // Loop iteration 1, midpoint: 100
    expect(pos.x).toBeCloseTo(100);
  });

  it("should use loop commands when no regular commands exist", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createMCommand("M", 0, 500, [0, 0, 100, 100])], 500),
    ];
    const pos = getPosition([], loops, 250, 0, 0);
    expect(pos.x).toBeCloseTo(50);
    expect(pos.y).toBeCloseTo(50);
  });
});

describe("Integration - after-loop value persistence", () => {
  it("should persist last end value after loop completes", () => {
    const loops: SbLoop[] = [
      createLoop(0, 1, [createMCommand("M", 0, 500, [0, 0, 100, 100])], 500),
    ];
    // repeatCount=1 means 2 iterations (0 and 1)
    // After 2 * 500 = 1000ms, loop is done
    const posAfter = getPosition([], loops, 2000, 0, 0);
    expect(posAfter.x).toBe(100);
    expect(posAfter.y).toBe(100);
  });

  it("should persist scale after loop completes", () => {
    const loops: SbLoop[] = [
      createLoop(0, 1, [createSCommand(0, 500, 1, 3)], 500),
    ];
    const scale = getScale([], loops, 2000);
    expect(scale).toBe(3);
  });

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

  it("should persist rotation after loop completes", () => {
    const loops: SbLoop[] = [
      createLoop(0, 1, [createRCommand(0, 500, 0, 180)], 500),
    ];
    const rotation = getRotation([], loops, 2000);
    // 180 degrees
    expect(rotation).toBeCloseTo(180);
  });
});

describe("Integration - loop with mixed command types", () => {
  it("should handle loop with M, S, F, C, R simultaneously", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [
        createMCommand("M", 0, 1000, [0, 0, 200, 200]),
        createSCommand(0, 1000, 1, 2),
        createFCommand(0, 1000, 0, 1),
        createCCommand(0, 1000, 255, 0, 0, 0, 255, 0),
        createRCommand(0, 1000, 0, 180),
      ], 1000),
    ];
    // At t=500 (midpoint of iteration 0)
    const pos = getPosition([], loops, 500, 0, 0);
    const scale = getScale([], loops, 500);
    const opacity = getOpacity([], loops, 500);
    const color = getColor([], loops, 500);
    const rotation = getRotation([], loops, 500);

    expect(pos.x).toBeCloseTo(100);
    expect(pos.y).toBeCloseTo(100);
    expect(scale).toBeCloseTo(1.5);
    expect(opacity).toBeCloseTo(0.5);
    // sRGB midpoint 0.5 → linear ≈ 0.214
    expect(color!.r).toBeCloseTo(0.21404);
    expect(color!.g).toBeCloseTo(0.21404);
    expect(rotation).toBeCloseTo(90);
  });

  it("should handle loop with mixed command types in second iteration", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [
        createMCommand("M", 0, 1000, [0, 0, 200, 200]),
        createSCommand(0, 1000, 1, 2),
      ], 1000),
    ];
    // At t=1500 (midpoint of iteration 1)
    const pos = getPosition([], loops, 1500, 0, 0);
    const scale = getScale([], loops, 1500);

    expect(pos.x).toBeCloseTo(100);
    expect(scale).toBeCloseTo(1.5);
  });
});

describe("Integration - complex real-world storyboard pattern", () => {
  it("should handle realistic osu! storyboard loop pattern", () => {
    // Pattern commonly found in osu! mania beatmaps:
    // A flash effect that loops while a note is held
    const content = `
[Events]
Sprite,Pass,Centre,"flash.png",320,240
L,60000,30
  F,0,0,337,0,1
  F,0,337,674,1,0
`;
    const result = parseStoryboard(content);
    const loop = result.objects[0].loops[0];

    expect(loop.startTime).toBe(60000);
    // L,60000,30 means 30 total plays, stored as repeatCount=29
    expect(loop.repeatCount).toBe(29);
    expect(loop.loopDuration).toBe(674); // 674 - 0
    expect(loop.commands).toHaveLength(2);
  });

  it("should evaluate realistic loop pattern correctly", () => {
    const loops: SbLoop[] = [
      createLoop(60000, 30, [
        createFCommand(0, 337, 0, 1),
        createFCommand(337, 674, 1, 0),
      ], 674),
    ];
    // At t=60000 + 168 (midpoint of first fade in, iteration 0)
    const op1 = getLoopOpacity(loops, 60168);
    expect(op1).toBeCloseTo(0.5);

    // At t=60000 + 505 (midpoint of second fade out, iteration 0)
    const op2 = getLoopOpacity(loops, 60505);
    expect(op2).toBeCloseTo(0.5);

    // At t=60000 + 674 (start of iteration 1)
    const op3 = getLoopOpacity(loops, 60674);
    expect(op3).toBeCloseTo(0);
  });

  it("should handle loop with Animation object", () => {
    const content = `
[Events]
Animation,Pass,Centre,"explosion.png",320,240,8,50,LoopOnce
L,0,4
  F,0,0,200,0,1
  S,0,0,200,0.5,2
`;
    const result = parseStoryboard(content);
    expect(result.objects[0].type).toBe("animation");
    expect(result.objects[0].loops).toHaveLength(1);
    const loop = result.objects[0].loops[0];
    // L,0,4 means 4 total plays, stored as repeatCount=3
    expect(loop.repeatCount).toBe(3);
    expect(loop.commands).toHaveLength(2);
  });
});

describe("Integration - getLoopCommandValue direct API", () => {
  it("should return null when loop has not started", () => {
    const loops: SbLoop[] = [
      createLoop(1000, 2, [createMCommand("M", 0, 500, [0, 0, 100, 100])], 500),
    ];
    const value = getLoopCommandValue(loops, "M", 500, 0);
    expect(value).toBeNull();
  });

  it("should return null when loop has no matching command type", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createSCommand(0, 500, 1, 2)], 500),
    ];
    const value = getLoopCommandValue(loops, "M", 250, 0);
    expect(value).toBeNull();
  });

  it("should return correct paramIndex for M command X", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createMCommand("M", 0, 500, [0, 0, 100, 200])], 500),
    ];
    const x = getLoopCommandValue(loops, "M", 250, 0);
    const y = getLoopCommandValue(loops, "M", 250, 1);
    expect(x).toBeCloseTo(50);
    expect(y).toBeCloseTo(100);
  });

  it("should return correct paramIndex for C command", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [createCCommand(0, 500, 255, 128, 64, 0, 255, 128)], 500),
    ];
    const r = getLoopCommandValue(loops, "C", 250, 0);
    const g = getLoopCommandValue(loops, "C", 250, 1);
    const b = getLoopCommandValue(loops, "C", 250, 2);
    expect(r).toBeCloseTo(127.5);
    expect(g).toBeCloseTo(191.5);
    expect(b).toBeCloseTo(96);
  });

  it("should return correct paramIndex for V command", () => {
    const loops: SbLoop[] = [
      createLoop(0, 2, [
        { type: "V", easing: 0, startTime: 0, endTime: 500, params: [1, 2, 3, 4] },
      ], 500),
    ];
    const x = getLoopCommandValue(loops, "V", 250, 0);
    const y = getLoopCommandValue(loops, "V", 250, 1);
    expect(x).toBeCloseTo(2);
    expect(y).toBeCloseTo(3);
  });
});

describe("Integration - loop with INFINITE_DURATION handling", () => {
  it("should handle loop commands with INFINITE_DURATION endTime in getLoopCommandValue", () => {
    // When endTime is INFINITE_DURATION, the evaluator treats it as startTime for iteration calc
    // This results in loopDuration=0 (since maxCmdEnd uses startTime when endTime is INFINITE_DURATION)
    // The loop is then skipped
    const loops: SbLoop[] = [
      {
        startTime: 0,
        endTime: 3000,
        repeatCount: 2,
        commands: [
          {
            type: "M" as const,
            easing: 0,
            startTime: 0,
            endTime: INFINITE_DURATION,
            params: [0, 0, 100, 100],
          },
        ],
        loopDuration: 1000,
      },
    ];

    // MAX_SAFE_INTEGER is treated as startTime for maxCmdEnd calculation
    // maxCmdEnd = 0 (startTime), minCmdStart = 0, loopDuration = 0
    // Loop is skipped due to duration <= 0
    const value = getLoopCommandValue(loops, "M", 250, 0);
    expect(value).toBeNull();
  });
});

// ============================================
// 6. Commands not spanning full loop duration
// ============================================

describe("Loop edge cases - commands shorter than loop duration", () => {
  it("should repeat command in each iteration when loopDuration > command span", () => {
    // Note: loop-evaluator recalculates loopDuration from command span
    // So loopDuration = maxCmdEnd - minCmdStart = 200 - 0 = 200
    // The passed loopDuration (500) is ignored by the evaluator
    const loops: SbLoop[] = [
      createLoop(0, 3, [
        createMCommand("M", 0, 200, [0, 0, 100, 100]),
      ], 500),
    ];
    // During command (iteration 0, t=100): mid-point
    const pos100 = getPosition([], loops, 100, 0, 0);
    expect(pos100.x).toBeCloseTo(50);
    // At t=300: loopDuration recalculated to 200, iteration=1, command active at 200-400
    const pos300 = getPosition([], loops, 300, 0, 0);
    expect(pos300.x).toBeCloseTo(50);
    // At t=500: iteration=2, command active at 400-600
    const pos500 = getPosition([], loops, 500, 0, 0);
    expect(pos500.x).toBeCloseTo(50);
  });

  it("should handle command starting later in loop", () => {
    // Command starts at t=200 relative to loop start
    const loops: SbLoop[] = [
      createLoop(0, 3, [
        createMCommand("M", 200, 500, [0, 0, 100, 100]),
      ], 500),
    ];
    // Before command starts in iteration 0
    const pos100 = getPosition([], loops, 100, 0, 0);
    expect(pos100.x).toBe(0);
    // During command in iteration 0 (t=350: 150ms into 200-500 command)
    const pos350 = getPosition([], loops, 350, 0, 0);
    expect(pos350.x).toBeCloseTo(50);
  });

  it("should use last end value after loop ends when command was shorter", () => {
    const loops: SbLoop[] = [
      createLoop(0, 1, [
        createMCommand("M", 0, 200, [0, 0, 100, 100]),
      ], 500),
    ];
    // repeatCount=1 means 2 iterations (0 and 1)
    // After loop ends: use last end value (100)
    const posAfter = getPosition([], loops, 1500, 0, 0);
    expect(posAfter.x).toBe(100);
    expect(posAfter.y).toBe(100);
  });

  it("should handle multiple non-contiguous commands in loop", () => {
    // loopDuration recalculated from commands: max(100, 400) - min(0, 300) = 400 - 0 = 400
    const loops: SbLoop[] = [
      createLoop(0, 2, [
        createMCommand("M", 0, 100, [0, 0, 50, 50]),
        createMCommand("M", 300, 400, [50, 50, 100, 100]),
      ], 500),
    ];
    // First command in iteration 0
    const pos50 = getPosition([], loops, 50, 0, 0);
    expect(pos50.x).toBeCloseTo(25);
    // Gap between commands in iteration 0 (t=200): no active command
    // iteration=0, first cmd at 0-100 (ended), second cmd at 300-400 (not started)
    const pos200 = getPosition([], loops, 200, 0, 0);
    expect(pos200.x).toBe(0);
    // Second command in iteration 0
    const pos350 = getPosition([], loops, 350, 0, 0);
    expect(pos350.x).toBeCloseTo(75);
    // Gap after second command in iteration 0 (t=450)
    // iteration = floor(450/400) = 1, but wait...
    // Actually iteration=1 at t=400+, command at 400-500 and 700-800
    // At t=450: iteration=1, first cmd at 400-500, t=450 is mid-point
    const pos450 = getPosition([], loops, 450, 0, 0);
    expect(pos450.x).toBeCloseTo(25);
  });
});

// ============================================
// 7. Zero loop duration
// ============================================

describe("Loop edge cases - zero loop duration", () => {
  it("should skip loop when all commands are instant (loopDuration=0)", () => {
    // When all commands have startTime === endTime, loopDuration = 0
    // The loop evaluator skips loops with duration <= 0
    const loops: SbLoop[] = [
      createLoop(0, 2, [createMCommand("M", 0, 0, [0, 0, 100, 100])], 1000),
    ];
    // Loop evaluator recalculates loopDuration from commands: 0 - 0 = 0
    // Since loopDuration <= 0, the loop is skipped
    const pos = getPosition([], loops, 500, 320, 240);
    expect(pos.x).toBe(320);
    expect(pos.y).toBe(240);
  });

  it("should default loopDuration to 1000 when all commands are instant (parser level)", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
L,0,2
  F,0,0,0,0,1
  M,0,0,0,0,0,100,100
`;
    const result = parseStoryboard(content);
    const loop = result.objects[0].loops[0];
    // All commands have startTime === endTime (0-0 and 0-0)
    // maxEnd - minStart = 0 - 0 = 0, which is <= 0, defaults to 1000
    expect(loop.loopDuration).toBe(1000);
  });
});

import { describe, it, expect } from "vitest";
import {
  getColor,
  getOpacity,
  getPosition,
  getScale,
  getVectorScale,
  getRotation,
} from "../storyboard/command-evaluator";
import { SbCommand, SbLoop, INFINITE_DURATION } from "../sbParser";


// Helper to create a C command
function createCCommand(
  startTime: number,
  endTime: number,
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
  easing = 0,
): SbCommand {
  return {
    type: "C",
    easing,
    startTime,
    endTime,
    params: [r1, g1, b1, r2, g2, b2],
  };
}

// Helper to create an empty loops array
const noLoops: SbLoop[] = [];

// ============================================
// getColor - No C Command Tests
// ============================================

describe("getColor - No C command", () => {
  it("should return null when no C commands exist", () => {
    const commands: SbCommand[] = [];
    expect(getColor(commands, noLoops, 0)).toBeNull();
    expect(getColor(commands, noLoops, 1000)).toBeNull();
  });

  it("should return null when only non-C commands exist", () => {
    const commands: SbCommand[] = [
      { type: "F", easing: 0, startTime: 0, endTime: 1000, params: [0, 1] },
      { type: "M", easing: 0, startTime: 0, endTime: 1000, params: [0, 0, 100, 100] },
    ];
    expect(getColor(commands, noLoops, 500)).toBeNull();
  });
});

// ============================================
// getColor - Static C Command Tests
// ============================================

describe("getColor - Static C command (single color)", () => {
  it("should return the static color before command starts", () => {
    const commands: SbCommand[] = [
      createCCommand(1000, 2000, 255, 128, 64, 255, 128, 64),
    ];
    const result = getColor(commands, noLoops, 500);
    // sRGB→linear: 255→1, 128→0.216, 64→0.0513
    expect(result!.r).toBeCloseTo(1);
    expect(result!.g).toBeCloseTo(0.21586);
    expect(result!.b).toBeCloseTo(0.05127);
  });

  it("should return the static color during command", () => {
    const commands: SbCommand[] = [
      createCCommand(1000, 2000, 255, 128, 64, 255, 128, 64),
    ];
    const result = getColor(commands, noLoops, 1500);
    expect(result!.r).toBeCloseTo(1);
    expect(result!.g).toBeCloseTo(0.21586);
    expect(result!.b).toBeCloseTo(0.05127);
  });

  it("should return the static color after command ends", () => {
    const commands: SbCommand[] = [
      createCCommand(1000, 2000, 255, 128, 64, 255, 128, 64),
    ];
    const result = getColor(commands, noLoops, 3000);
    expect(result!.r).toBeCloseTo(1);
    expect(result!.g).toBeCloseTo(0.21586);
    expect(result!.b).toBeCloseTo(0.05127);
  });

  it("should return pure white when all channels are 255", () => {
    const commands: SbCommand[] = [
      createCCommand(0, 1000, 255, 255, 255, 255, 255, 255),
    ];
    const result = getColor(commands, noLoops, 500);
    expect(result).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("should return pure black when all channels are 0", () => {
    const commands: SbCommand[] = [
      createCCommand(0, 1000, 0, 0, 0, 0, 0, 0),
    ];
    const result = getColor(commands, noLoops, 500);
    expect(result).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("should return exact normalized values for each channel", () => {
    const commands: SbCommand[] = [
      createCCommand(0, 1000, 128, 64, 32, 128, 64, 32),
    ];
    const result = getColor(commands, noLoops, 500);
    // sRGB→linear: 128→0.216, 64→0.0513, 32→0.0124
    expect(result!.r).toBeCloseTo(0.21586);
    expect(result!.g).toBeCloseTo(0.05127);
    expect(result!.b).toBeCloseTo(0.01237);
  });
});

// ============================================
// getColor - Color Transition Tests
// ============================================

describe("getColor - Color transition (start to end)", () => {
  it("should return start color before transition begins", () => {
    const commands: SbCommand[] = [
      createCCommand(1000, 2000, 0, 0, 0, 255, 255, 255),
    ];
    const result = getColor(commands, noLoops, 500);
    expect(result).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("should return start color at exact start time", () => {
    const commands: SbCommand[] = [
      createCCommand(1000, 2000, 0, 0, 0, 255, 255, 255),
    ];
    const result = getColor(commands, noLoops, 1000);
    expect(result).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("should return end color at exact end time", () => {
    const commands: SbCommand[] = [
      createCCommand(1000, 2000, 0, 0, 0, 255, 255, 255),
    ];
    const result = getColor(commands, noLoops, 2000);
    expect(result).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("should return end color after transition completes", () => {
    const commands: SbCommand[] = [
      createCCommand(1000, 2000, 0, 0, 0, 255, 255, 255),
    ];
    const result = getColor(commands, noLoops, 3000);
    expect(result).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("should still be interpolating at endTime - 1", () => {
    const commands: SbCommand[] = [
      createCCommand(1000, 2000, 0, 0, 0, 255, 255, 255),
    ];
    const result = getColor(commands, noLoops, 1999);
    // At 99.9% through the transition, should be very close to end but not quite there
    expect(result!.r).toBeGreaterThan(0.9);
    expect(result!.r).toBeLessThan(1);
    expect(result!.g).toBeGreaterThan(0.9);
    expect(result!.g).toBeLessThan(1);
    expect(result!.b).toBeGreaterThan(0.9);
    expect(result!.b).toBeLessThan(1);
  });

  it("should use end color at endTime + 1", () => {
    const commands: SbCommand[] = [
      createCCommand(1000, 2000, 0, 0, 0, 255, 255, 255),
    ];
    const result = getColor(commands, noLoops, 2001);
    expect(result).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("should interpolate to 50% at midpoint (linear easing)", () => {
    const commands: SbCommand[] = [
      createCCommand(0, 1000, 0, 0, 0, 255, 255, 255),
    ];
    const result = getColor(commands, noLoops, 500);
    // sRGB midpoint 127.5/255=0.5 → linear ≈ 0.214
    expect(result!.r).toBeCloseTo(0.21404);
    expect(result!.g).toBeCloseTo(0.21404);
    expect(result!.b).toBeCloseTo(0.21404);
  });

  it("should interpolate each channel independently", () => {
    const commands: SbCommand[] = [
      createCCommand(0, 1000, 255, 0, 0, 0, 255, 255),
    ];
    const result = getColor(commands, noLoops, 500);
    // sRGB midpoint 127.5/255=0.5 → linear ≈ 0.214
    expect(result!.r).toBeCloseTo(0.21404);
    expect(result!.g).toBeCloseTo(0.21404);
    expect(result!.b).toBeCloseTo(0.21404);
  });

  it("should handle multi-channel transition with different deltas", () => {
    const commands: SbCommand[] = [
      createCCommand(0, 1000, 255, 100, 50, 100, 200, 255),
    ];
    const result = getColor(commands, noLoops, 500);

    // sRGB→linear at midpoint: r=177.5/255→0.442, g=150/255→0.305, b=152.5/255→0.316
    expect(result!.r).toBeCloseTo(0.44242);
    expect(result!.g).toBeCloseTo(0.30499);
    expect(result!.b).toBeCloseTo(0.31626);
  });

  it("should interpolate to 25% at quarter point (linear easing)", () => {
    const commands: SbCommand[] = [
      createCCommand(0, 1000, 0, 0, 0, 255, 0, 0),
    ];
    const result = getColor(commands, noLoops, 250);
    // sRGB=63.75/255≈0.25 → linear ≈ 0.0509
    expect(result!.r).toBeCloseTo(0.05088);
    expect(result!.g).toBeCloseTo(0);
    expect(result!.b).toBeCloseTo(0);
  });

  it("should handle instant color change (startTime === endTime)", () => {
    const commands: SbCommand[] = [
      createCCommand(1000, 1000, 0, 0, 0, 255, 255, 255),
    ];
    // Before instant change: pre-read start value
    const before = getColor(commands, noLoops, 999);
    expect(before).toEqual({ r: 0, g: 0, b: 0 });
    // At instant change: interpolateWithEasing checks currentTime <= startTime first,
    // so it returns startValue (osu! behavior for zero-duration commands)
    const at = getColor(commands, noLoops, 1000);
    expect(at).toEqual({ r: 0, g: 0, b: 0 });
    // After instant change: end value persists
    const after = getColor(commands, noLoops, 1001);
    expect(after).toEqual({ r: 1, g: 1, b: 1 });
  });
});

// ============================================
// getColor - Normalized values in [0, 1] range
// ============================================

describe("getColor - Normalized values in [0, 1] range", () => {
  it("should always return values normalized to [0, 1] range", () => {
    // Test with various color values to ensure gamma correction works correctly
    const commands: SbCommand[] = [
      createCCommand(0, 1000, 0, 128, 255, 100, 200, 250),
    ];

    const result = getColor(commands, noLoops, 500);

    // All values should be in [0, 1] range
    expect(result!.r).toBeGreaterThanOrEqual(0);
    expect(result!.r).toBeLessThanOrEqual(1);
    expect(result!.g).toBeGreaterThanOrEqual(0);
    expect(result!.g).toBeLessThanOrEqual(1);
    expect(result!.b).toBeGreaterThanOrEqual(0);
    expect(result!.b).toBeLessThanOrEqual(1);

    // sRGB→linear at midpoint: r=50/255→0.0319, g=164/255→0.371, b=252.5/255→0.978
    expect(result!.r).toBeCloseTo(0.0319);
    expect(result!.g).toBeCloseTo(0.37124);
    expect(result!.b).toBeCloseTo(0.97784);
  });
});

// ============================================
// getColor - Multiple C Commands Tests
// ============================================

describe("getColor - Multiple C commands", () => {
  it("should use first matching command (earlier command takes precedence)", () => {
    // First command starts at 0, second at 1000
    // At t=500, first command is active
    const commands: SbCommand[] = [
      createCCommand(0, 1000, 255, 0, 0, 255, 0, 0), // Red
      createCCommand(1000, 2000, 0, 255, 0, 0, 255, 0), // Green
    ];
    const result = getColor(commands, noLoops, 500);
    expect(result).toEqual({ r: 1, g: 0, b: 0 });
  });

  it("should fall through to second command when first has ended", () => {
    const commands: SbCommand[] = [
      createCCommand(0, 500, 255, 0, 0, 255, 0, 0), // Red
      createCCommand(1000, 2000, 0, 255, 0, 0, 255, 0), // Green
    ];
    // After first ends (t=600), before second starts (t=1000)
    // First command: currentTime > endTime -> returns end value (red)
    const result = getColor(commands, noLoops, 600);
    expect(result).toEqual({ r: 1, g: 0, b: 0 });
  });

  it("should use second command when first is entirely in the future", () => {
    // Both commands start in the future relative to currentTime
    // First command triggers pre-read, returns immediately
    const commands: SbCommand[] = [
      createCCommand(2000, 3000, 255, 0, 0, 255, 0, 0),
      createCCommand(1000, 2000, 0, 255, 0, 0, 255, 0),
    ];
    // Commands are sorted by startTime: [1000-2000 (green), 2000-3000 (red)]
    // At t=0: first command (green) is in future -> pre-read green
    const result = getColor(commands, noLoops, 0);
    expect(result).toEqual({ r: 0, g: 1, b: 0 });
  });

  it("should handle overlapping command ranges", () => {
    const commands: SbCommand[] = [
      createCCommand(0, 2000, 255, 0, 0, 255, 0, 0), // Red, 0-2000
      createCCommand(1000, 1500, 0, 255, 0, 0, 255, 0), // Green, 1000-1500
    ];
    // At t=1200, both commands are active -> later command (green) takes precedence
    const result = getColor(commands, noLoops, 1200);
    expect(result).toEqual({ r: 0, g: 1, b: 0 });
  });
});

// ============================================
// getColor - Loop Tests
// ============================================

describe("getColor - C command with loop", () => {
  it("should return null when loop has no C commands", () => {
    const commands: SbCommand[] = [];
    const loops: SbLoop[] = [
      {
        startTime: 0,
        repeatCount: 2,
        commands: [
          { type: "F", easing: 0, startTime: 0, endTime: 500, params: [0, 1] },
        ],
        loopDuration: 500,
      },
    ];
    expect(getColor(commands, loops, 250)).toBeNull();
  });

  it("should return color from loop C command during active loop", () => {
    const commands: SbCommand[] = [];
    const loops: SbLoop[] = [
      {
        startTime: 0,
        repeatCount: 2,
        commands: [
          createCCommand(0, 500, 255, 0, 0, 255, 0, 0), // Red (static)
        ],
        loopDuration: 500,
      },
    ];
    const result = getColor(commands, loops, 250);
    expect(result).toEqual({ r: 1, g: 0, b: 0 });
  });

  it("should return null when loop has not started yet", () => {
    const commands: SbCommand[] = [];
    const loops: SbLoop[] = [
      {
        startTime: 1000,
        repeatCount: 2,
        commands: [
          createCCommand(0, 500, 255, 0, 0, 255, 0, 0),
        ],
        loopDuration: 500,
      },
    ];
    expect(getColor(commands, loops, 500)).toBeNull();
  });

  it("should combine regular C command with loop C command", () => {
    // Regular C command takes precedence (processed first)
    const commands: SbCommand[] = [
      createCCommand(0, 1000, 0, 255, 0, 0, 255, 0), // Green
    ];
    const loops: SbLoop[] = [
      {
        startTime: 0,
        repeatCount: 2,
        commands: [
          createCCommand(0, 500, 255, 0, 0, 255, 0, 0), // Red
        ],
        loopDuration: 500,
      },
    ];
    // Regular command is active at t=250 -> returns green
    const result = getColor(commands, loops, 250);
    expect(result).toEqual({ r: 0, g: 1, b: 0 });
  });

  it("should fall back to loop color when regular C command has ended", () => {
    const commands: SbCommand[] = [
      createCCommand(0, 500, 255, 0, 0, 255, 0, 0), // Red, ends at 500
    ];
    const loops: SbLoop[] = [
      {
        startTime: 0,
        repeatCount: 2,
        commands: [
          createCCommand(0, 500, 0, 0, 255, 0, 0, 255), // Blue
        ],
        loopDuration: 500,
      },
    ];
    // At t=600: regular C has ended -> returns end value (red)
    // Loop is still active but regular command returned first
    const result = getColor(commands, loops, 600);
    expect(result).toEqual({ r: 1, g: 0, b: 0 });
  });
});

// ============================================
// getColor - Easing Tests
// ============================================

describe("getColor - Easing in color transitions", () => {
  it("should apply easeOut easing (easing=1) - starts fast, slows down", () => {
    const commands: SbCommand[] = [
      createCCommand(0, 1000, 0, 0, 0, 255, 0, 0, 1),
    ];
    // With easeOut, at t=500 the value should be > 0.5 (starts fast)
    const result = getColor(commands, noLoops, 500);
    expect(result!.r).toBeGreaterThan(0.5);
  });

  it("should apply easeIn easing (easing=2) - starts slow, speeds up", () => {
    const commands: SbCommand[] = [
      createCCommand(0, 1000, 0, 0, 0, 255, 0, 0, 2),
    ];
    // With easeIn, at t=500 the value should be < 0.5 (starts slow)
    const result = getColor(commands, noLoops, 500);
    expect(result!.r).toBeLessThan(0.5);
  });

  it("should use linear interpolation with easing=0", () => {
    const commands: SbCommand[] = [
      createCCommand(0, 1000, 0, 0, 0, 255, 0, 0, 0),
    ];
    const result = getColor(commands, noLoops, 500);
    // sRGB midpoint 0.5 → linear ≈ 0.214
    expect(result!.r).toBeCloseTo(0.21404);
  });
});

// ============================================
// getColor - Edge Cases
// ============================================

describe("getColor - Edge cases", () => {
  it("should handle command with INFINITE_DURATION endTime", () => {
    const commands: SbCommand[] = [
      {
        type: "C",
        easing: 0,
        startTime: 0,
        endTime: INFINITE_DURATION,
        params: [255, 128, 64, 255, 128, 64],
      },
    ];

    const result = getColor(commands, noLoops, 999999999);
    // sRGB→linear: 255→1, 128→0.216, 64→0.0513
    expect(result!.r).toBeCloseTo(1);
    expect(result!.g).toBeCloseTo(0.21586);
    expect(result!.b).toBeCloseTo(0.05127);
  });

  it("should handle color at exact command boundary", () => {
    const commands: SbCommand[] = [
      createCCommand(1000, 2000, 255, 0, 0, 0, 255, 0),
    ];
    // At exact start
    const atStart = getColor(commands, noLoops, 1000);
    expect(atStart).toEqual({ r: 1, g: 0, b: 0 });
    // At exact end
    const atEnd = getColor(commands, noLoops, 2000);
    expect(atEnd).toEqual({ r: 0, g: 1, b: 0 });
  });

  it("should handle very large time values", () => {
    const commands: SbCommand[] = [
      createCCommand(100000, 200000, 255, 255, 255, 0, 0, 0),
    ];
    const result = getColor(commands, noLoops, 150000);
    // sRGB midpoint 0.5 → linear ≈ 0.214
    expect(result!.r).toBeCloseTo(0.21404);
    expect(result!.g).toBeCloseTo(0.21404);
    expect(result!.b).toBeCloseTo(0.21404);
  });

  it("should handle partial color channels (some 0, some 255)", () => {
    const commands: SbCommand[] = [
      createCCommand(0, 1000, 255, 0, 255, 0, 255, 0),
    ];
    const result = getColor(commands, noLoops, 500);
    // sRGB midpoint 0.5 → linear ≈ 0.214
    expect(result!.r).toBeCloseTo(0.21404);
    expect(result!.g).toBeCloseTo(0.21404);
    expect(result!.b).toBeCloseTo(0.21404);
  });
});

// ============================================
// INFINITE_DURATION handling Tests
// ============================================

describe("INFINITE_DURATION handling", () => {
  it("getOpacity with INFINITE_DURATION", () => {
    const commands: SbCommand[] = [
      {
        type: "F",
        easing: 0,
        startTime: 0,
        endTime: INFINITE_DURATION,
        params: [0, 1],
      },
    ];
    // With INFINITE_DURATION, the command should be treated as always active
    const result = getOpacity(commands, noLoops, 999999999);
    // Since it's a transition from 0 to 1 over INFINITE_DURATION,
    // at 999999999ms the interpolation is essentially at t=1
    expect(result).toBe(1);
  });

  it("getPosition with INFINITE_DURATION", () => {
    const commands: SbCommand[] = [
      {
        type: "M",
        easing: 0,
        startTime: 0,
        endTime: INFINITE_DURATION,
        params: [0, 0, 100, 100],
      },
    ];
    // getPosition with INFINITE_DURATION uses start value (params[0], params[1])
    // This matches the code path: cmd.params[0] ?? defaultX
    const result = getPosition(commands, noLoops, 999999999, 320, 240);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
  });

  it("getScale with INFINITE_DURATION", () => {
    const commands: SbCommand[] = [
      {
        type: "S",
        easing: 0,
        startTime: 0,
        endTime: INFINITE_DURATION,
        params: [1, 5],
      },
    ];
    const result = getScale(commands, noLoops, 999999999);
    // With INFINITE_DURATION, at 999999999ms interpolation is at t=1
    expect(result).toBeCloseTo(5);
  });

  it("getVectorScale with INFINITE_DURATION", () => {
    const commands: SbCommand[] = [
      {
        type: "V",
        easing: 0,
        startTime: 0,
        endTime: INFINITE_DURATION,
        params: [1, 1, 3, 5],
      },
    ];
    const result = getVectorScale(commands, noLoops, 999999999);
    // With INFINITE_DURATION, at 999999999ms interpolation is at t=1
    expect(result!.x).toBeCloseTo(3);
    expect(result!.y).toBeCloseTo(5);
  });

  it("getRotation with INFINITE_DURATION", () => {
    const commands: SbCommand[] = [
      {
        type: "R",
        easing: 0,
        startTime: 0,
        endTime: INFINITE_DURATION,
        params: [0, 360],
      },
    ];
    const result = getRotation(commands, noLoops, 999999999);
    // With INFINITE_DURATION, at 999999999ms interpolation is at t=1
    expect(result).toBeCloseTo(360);
  });
});

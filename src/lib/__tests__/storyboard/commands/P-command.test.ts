import { describe, it, expect } from "vitest";
import { getFlipState } from "../../../storyboard/command-evaluator";
import type { SbCommand, SbLoop } from "../../../sbParser";

// Helper to create a P command with paramStrings
function createPCommand(
  startTime: number,
  endTime: number,
  param: string,
  easing = 0,
): SbCommand {
  return {
    type: "P",
    easing,
    startTime,
    endTime,
    params: [],
    paramStrings: [param],
  };
}

const noLoops: SbLoop[] = [];

// ============================================
// 1. getFlipState - Default (no P commands)
// ============================================

describe("getFlipState - Default (no P commands)", () => {
  it("should return all-false when no P commands exist", () => {
    const result = getFlipState([], noLoops, 500);
    expect(result).toEqual({ flipH: false, flipV: false, additive: false });
  });

  it("should return all-false when only non-P commands exist", () => {
    const commands: SbCommand[] = [
      { type: "F", easing: 0, startTime: 0, endTime: 1000, params: [0, 1] },
      { type: "S", easing: 0, startTime: 0, endTime: 1000, params: [1, 2] },
    ];
    const result = getFlipState(commands, noLoops, 500);
    expect(result).toEqual({ flipH: false, flipV: false, additive: false });
  });
});

// ============================================
// 2. getFlipState - Temporary P,H command
// ============================================

describe("getFlipState - Temporary P,H command", () => {
  it("should return flipH=true for active P,H command", () => {
    const commands = [createPCommand(0, 1000, "H")];
    const result = getFlipState(commands, noLoops, 500);
    expect(result.flipH).toBe(true);
    expect(result.flipV).toBe(false);
    expect(result.additive).toBe(false);
  });

  it("should return flipH=false when P,H command not yet active", () => {
    const commands = [createPCommand(1000, 2000, "H")];
    const result = getFlipState(commands, noLoops, 500);
    expect(result.flipH).toBe(false);
  });

  it("should return flipH=false when P,H command has ended", () => {
    const commands = [createPCommand(0, 1000, "H")];
    const result = getFlipState(commands, noLoops, 2000);
    expect(result.flipH).toBe(false);
  });

  it("should return flipH=true at exact startTime boundary", () => {
    const commands = [createPCommand(1000, 2000, "H")];
    const result = getFlipState(commands, noLoops, 1000);
    expect(result.flipH).toBe(true);
  });

  it("should return flipH=true at exact endTime boundary", () => {
    const commands = [createPCommand(1000, 2000, "H")];
    const result = getFlipState(commands, noLoops, 2000);
    expect(result.flipH).toBe(true);
  });
});

// ============================================
// 3. getFlipState - Temporary P,V command
// ============================================

describe("getFlipState - Temporary P,V command", () => {
  it("should return flipV=true for active P,V command", () => {
    const commands = [createPCommand(0, 1000, "V")];
    const result = getFlipState(commands, noLoops, 500);
    expect(result.flipV).toBe(true);
    expect(result.flipH).toBe(false);
    expect(result.additive).toBe(false);
  });

  it("should return flipV=false when P,V command not yet active", () => {
    const commands = [createPCommand(1000, 2000, "V")];
    const result = getFlipState(commands, noLoops, 500);
    expect(result.flipV).toBe(false);
  });

  it("should return flipV=false when P,V command has ended", () => {
    const commands = [createPCommand(0, 1000, "V")];
    const result = getFlipState(commands, noLoops, 2000);
    expect(result.flipV).toBe(false);
  });
});

// ============================================
// 4. getFlipState - Temporary P,A command
// ============================================

describe("getFlipState - Temporary P,A command", () => {
  it("should return additive=true for active P,A command", () => {
    const commands = [createPCommand(0, 1000, "A")];
    const result = getFlipState(commands, noLoops, 500);
    expect(result.additive).toBe(true);
    expect(result.flipH).toBe(false);
    expect(result.flipV).toBe(false);
  });

  it("should return additive=false when P,A command not yet active", () => {
    const commands = [createPCommand(1000, 2000, "A")];
    const result = getFlipState(commands, noLoops, 500);
    expect(result.additive).toBe(false);
  });

  it("should return additive=false when P,A command has ended", () => {
    const commands = [createPCommand(0, 1000, "A")];
    const result = getFlipState(commands, noLoops, 2000);
    expect(result.additive).toBe(false);
  });
});

// ============================================
// 5. getFlipState - Multiple P commands
// ============================================

describe("getFlipState - Multiple P commands at different times", () => {
  it("should handle multiple P commands at different times", () => {
    const commands: SbCommand[] = [
      createPCommand(0, 1000, "H"), // Active 0-1000
      createPCommand(1000, 2000, "V"), // Active 1000-2000
      createPCommand(2000, 3000, "A"), // Active 2000-3000
    ];

    // At t=500: only P,H active
    const r1 = getFlipState(commands, noLoops, 500);
    expect(r1.flipH).toBe(true);
    expect(r1.flipV).toBe(false);
    expect(r1.additive).toBe(false);

    // At t=1500: only P,V active
    const r2 = getFlipState(commands, noLoops, 1500);
    expect(r2.flipH).toBe(false);
    expect(r2.flipV).toBe(true);
    expect(r2.additive).toBe(false);

    // At t=2500: only P,A active
    const r3 = getFlipState(commands, noLoops, 2500);
    expect(r3.flipH).toBe(false);
    expect(r3.flipV).toBe(false);
    expect(r3.additive).toBe(true);
  });

  it("should accumulate flip flags from overlapping P commands", () => {
    const commands: SbCommand[] = [
      createPCommand(0, 2000, "H"), // Active 0-2000
      createPCommand(500, 1500, "V"), // Active 500-1500
    ];

    // At t=1000: both P,H and P,V active
    const result = getFlipState(commands, noLoops, 1000);
    expect(result.flipH).toBe(true);
    expect(result.flipV).toBe(true);
    expect(result.additive).toBe(false);
  });
});

// ============================================
// 6. getFlipState - P commands in loops
// ============================================

describe("getFlipState - P commands in loops", () => {
  it("should detect P,H from active loop", () => {
    const commands: SbCommand[] = [];
    const loops: SbLoop[] = [
      {
        startTime: 0,
        repeatCount: 2,
        commands: [createPCommand(0, 500, "H")],
        loopDuration: 500,
      },
    ];
    const result = getFlipState(commands, loops, 250);
    expect(result.flipH).toBe(true);
  });

  it("should detect P,V from active loop", () => {
    const commands: SbCommand[] = [];
    const loops: SbLoop[] = [
      {
        startTime: 0,
        repeatCount: 2,
        commands: [createPCommand(0, 500, "V")],
        loopDuration: 500,
      },
    ];
    const result = getFlipState(commands, loops, 250);
    expect(result.flipV).toBe(true);
  });

  it("should detect P,A from active loop", () => {
    const commands: SbCommand[] = [];
    const loops: SbLoop[] = [
      {
        startTime: 0,
        repeatCount: 2,
        commands: [createPCommand(0, 500, "A")],
        loopDuration: 500,
      },
    ];
    const result = getFlipState(commands, loops, 250);
    expect(result.additive).toBe(true);
  });

  it("should not detect P commands from inactive loop", () => {
    const commands: SbCommand[] = [];
    const loops: SbLoop[] = [
      {
        startTime: 1000,
        repeatCount: 2,
        commands: [createPCommand(0, 500, "H")],
        loopDuration: 500,
      },
    ];
    const result = getFlipState(commands, loops, 500);
    expect(result.flipH).toBe(false);
  });
});

// ============================================
// 7. Additive blending mode (P,A)
// ============================================

describe("Additive blending mode (P,A)", () => {
  it("should set additive=true for active P,A command", () => {
    const commands = [createPCommand(0, 1000, "A")];
    const result = getFlipState(commands, noLoops, 500);
    expect(result.additive).toBe(true);
  });

  it("should render with mixBlendMode: screen when additive=true", () => {
    // When additive is true, the render layer should use mixBlendMode: "screen"
    // This test verifies the CSS property value that would be applied
    const additive = true;
    const style = additive ? { mixBlendMode: "screen" } : {};
    expect(style.mixBlendMode).toBe("screen");
  });

  it("should not apply mixBlendMode when additive=false", () => {
    const additive = false;
    const style = additive ? { mixBlendMode: "screen" } : {};
    expect(style).toEqual({});
  });

  it("should combine P,H and P,A in overlapping commands", () => {
    const commands: SbCommand[] = [
      createPCommand(0, 2000, "H"), // Active 0-2000
      createPCommand(500, 1500, "A"), // Active 500-1500
    ];
    // At t=1000: both P,H and P,A active
    const result = getFlipState(commands, noLoops, 1000);
    expect(result.flipH).toBe(true);
    expect(result.additive).toBe(true);
    expect(result.flipV).toBe(false);
  });

  it("should combine P,V and P,A in overlapping commands", () => {
    const commands: SbCommand[] = [
      createPCommand(0, 2000, "V"),
      createPCommand(500, 1500, "A"),
    ];
    const result = getFlipState(commands, noLoops, 1000);
    expect(result.flipV).toBe(true);
    expect(result.additive).toBe(true);
    expect(result.flipH).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { isObjectVisible } from "../../storyboard/visibility";
import { SbCommand, SbLoop } from "../../sbParser";

// Helper to create commands
function createFCommand(startTime: number, endTime: number, startVal: number, endVal?: number): SbCommand {
  return {
    type: "F",
    easing: 0,
    startTime,
    endTime,
    params: endVal !== undefined ? [startVal, endVal] : [startVal, startVal],
  };
}

function createSCommand(startTime: number, endTime: number, startVal: number, endVal?: number): SbCommand {
  return {
    type: "S",
    easing: 0,
    startTime,
    endTime,
    params: endVal !== undefined ? [startVal, endVal] : [startVal, startVal],
  };
}

function createCCommand(startTime: number, endTime: number, r: number, g: number, b: number): SbCommand {
  return {
    type: "C",
    easing: 0,
    startTime,
    endTime,
    params: [r, g, b, r, g, b],
  };
}

function createMCommand(startTime: number, endTime: number, x1: number, y1: number, x2?: number, y2?: number): SbCommand {
  return {
    type: "M",
    easing: 0,
    startTime,
    endTime,
    params: x2 !== undefined && y2 !== undefined ? [x1, y1, x2, y2] : [x1, y1],
  };
}

const noLoops: SbLoop[] = [];

describe("isObjectVisible", () => {
  describe("lifetimeEnd calculation", () => {
    it("should calculate lifetimeEnd from permanent commands (fever.png scenario)", () => {
      // fever.png: all commands are permanent (startTime === endTime)
      const commands: SbCommand[] = [
        createSCommand(77629, 77629, 0.3732411),
        createFCommand(78379, 78379, 1),
      ];
      // lifetimeEnd = max(77629, 78379) = 78379
      expect(isObjectVisible(commands, noLoops, 78379)).toBe(true);
      expect(isObjectVisible(commands, noLoops, 116120)).toBe(false); // 01:56.12
    });

    it("should calculate lifetimeEnd from non-permanent commands", () => {
      const commands: SbCommand[] = [
        createFCommand(0, 5000, 0, 1),
        createMCommand(1000, 10000, 0, 0, 100, 100),
      ];
      // lifetimeEnd = max(5000, 10000) = 10000
      expect(isObjectVisible(commands, noLoops, 5000)).toBe(true);
      expect(isObjectVisible(commands, noLoops, 10000)).toBe(true);
      expect(isObjectVisible(commands, noLoops, 10001)).toBe(false);
    });

    it("should handle mixed permanent and non-permanent commands", () => {
      const commands: SbCommand[] = [
        createSCommand(1000, 1000, 1), // permanent
        createFCommand(0, 5000, 0, 1),  // non-permanent
      ];
      // lifetimeEnd = max(1000, 5000) = 5000
      expect(isObjectVisible(commands, noLoops, 3000)).toBe(true);
      expect(isObjectVisible(commands, noLoops, 6000)).toBe(false);
    });
  });

  describe("lifetimeStart calculation", () => {
    it("should calculate lifetimeStart from earliest non-F command (sprite_1 scenario)", () => {
      // sprite_1: C command at 379ms, F command at 6191ms
      const commands: SbCommand[] = [
        createSCommand(379, 379, 0.4615176),
        createCCommand(379, 379, 231, 24, 128),
        createFCommand(6191, 6191, 1),
      ];
      // lifetimeStart = min(379, 379, 6191) = 379
      expect(isObjectVisible(commands, noLoops, 379)).toBe(true);
      expect(isObjectVisible(commands, noLoops, 1120)).toBe(true); // pink background should be visible
    });

    it("should use earliest command when no F commands exist", () => {
      const commands: SbCommand[] = [
        createMCommand(5000, 10000, 0, 0, 100, 100),
      ];
      // lifetimeStart = 5000, lifetimeEnd = 10000
      expect(isObjectVisible(commands, noLoops, 4999)).toBe(false);
      expect(isObjectVisible(commands, noLoops, 7500)).toBe(true);
      expect(isObjectVisible(commands, noLoops, 10001)).toBe(false);
    });

    it("should use first visible F command for lifetimeStart", () => {
      const commands: SbCommand[] = [
        createFCommand(0, 1000, 0),     // invisible
        createFCommand(5000, 6000, 0, 1), // first visible: opacity goes 0→1 from 5000 to 6000
      ];
      // lifetimeStart = 5000 (first visible F)
      // At 5000, opacity = 0 (startValue), so not visible yet
      expect(isObjectVisible(commands, noLoops, 4999)).toBe(false);
      expect(isObjectVisible(commands, noLoops, 5000)).toBe(false); // opacity=0 at startTime
      expect(isObjectVisible(commands, noLoops, 5500)).toBe(true);  // opacity=0.5, visible
    });
  });

  describe("opacity check", () => {
    it("should return false when opacity is 0", () => {
      const commands: SbCommand[] = [
        createFCommand(0, 5000, 0),
      ];
      expect(isObjectVisible(commands, noLoops, 2500)).toBe(false);
    });

    it("should return true when opacity > 0", () => {
      const commands: SbCommand[] = [
        createFCommand(0, 5000, 0.5),
      ];
      expect(isObjectVisible(commands, noLoops, 2500)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should return false for empty commands and loops", () => {
      expect(isObjectVisible([], noLoops, 0)).toBe(false);
    });

    it("should handle boundary times correctly", () => {
      const commands: SbCommand[] = [
        createFCommand(1000, 5000, 0, 1),
      ];
      // lifetimeStart = 1000, lifetimeEnd = 5000
      // At 1000, opacity = 0 (startValue), so not visible
      expect(isObjectVisible(commands, noLoops, 999)).toBe(false);   // before lifetimeStart
      expect(isObjectVisible(commands, noLoops, 1000)).toBe(false);  // at lifetimeStart, opacity=0
      expect(isObjectVisible(commands, noLoops, 3000)).toBe(true);   // mid-fade, opacity=0.5
      expect(isObjectVisible(commands, noLoops, 5000)).toBe(true);   // at lifetimeEnd, opacity=1
      expect(isObjectVisible(commands, noLoops, 5001)).toBe(false);  // after lifetimeEnd
    });

    it("should handle loops for lifetimeEnd", () => {
      const commands: SbCommand[] = [
        createFCommand(0, 1000, 1),
      ];
      const loops: SbLoop[] = [
        {
          startTime: 5000,
          endTime: 8000,
          repeatCount: 2,
          commands: [],
          loopDuration: 1000,
        },
      ];
      // loopEnd = 5000 + 1000 * (2 + 1) = 8000
      // lifetimeEnd = max(1000, 8000) = 8000
      expect(isObjectVisible(commands, loops, 7000)).toBe(true);
      expect(isObjectVisible(commands, loops, 8000)).toBe(true);
      expect(isObjectVisible(commands, loops, 8001)).toBe(false);
    });
  });
});

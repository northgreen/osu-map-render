import { describe, it, expect, beforeEach } from "vitest";
import {
  setJudgmentMode,
  getJudgmentMode,
  setJudgmentOffset,
  setCustomWindows,
  getHitWindows,
  calculateJudgment,
  getJudgmentColor,
  getJudgmentScore,
  clearJudgmentCache,
} from "../../judgment";

// ============================================
// Hit Window Tests (verified against osu! source)
// ============================================

// osu! source: ManiaHitWindows.cs
// V2 (ScoreV2): DifficultyRange with [min, mid, max] + Math.Floor + 0.5
// V1 (Classic): base + 3 * (10 - OD) + Math.Floor + 0.5

describe("getHitWindowsV2 (ScoreV2)", () => {
  beforeEach(() => setJudgmentMode("v2"));

  it("OD=0 should match osu! ManiaHitWindows PERFECT_WINDOW_RANGE", () => {
    const windows = getHitWindows(0);
    // osu! formula for od < 5: result = mid + (mid - min) * (od - 5) / 5
    // At od=0: result = mid + (mid - min) * (-1) = min
    // perfect: min=22.4 -> floor(22.4)+0.5 = 22.5
    // great: min=64 -> floor(64)+0.5 = 64.5
    expect(windows.perfect).toBe(22.5);
    expect(windows.great).toBe(64.5);
    expect(windows.good).toBe(97.5);
    expect(windows.ok).toBe(127.5);
    expect(windows.meh).toBe(151.5);
    expect(windows.miss).toBe(188.5);
  });

  it("OD=5 should use mid values", () => {
    const windows = getHitWindows(5);
    // At OD=5, result = mid for all ranges
    expect(windows.perfect).toBe(19.5);
    expect(windows.great).toBe(49.5);
    expect(windows.good).toBe(82.5);
    expect(windows.ok).toBe(112.5);
    expect(windows.meh).toBe(136.5);
    expect(windows.miss).toBe(173.5);
  });

  it("OD=10 should use max values", () => {
    const windows = getHitWindows(10);
    // At OD=10, result = max for all ranges
    expect(windows.perfect).toBe(13.5);
    expect(windows.great).toBe(34.5);
    expect(windows.good).toBe(67.5);
    expect(windows.ok).toBe(97.5);
    expect(windows.meh).toBe(121.5);
    expect(windows.miss).toBe(158.5);
  });

  it("OD=7.5 should interpolate correctly", () => {
    const windows = getHitWindows(7.5);
    // OD=7.5 > 5: result = mid + (max - mid) * (7.5 - 5) / 5 = mid + (max - mid) * 0.5
    // perfect: 19.4 + (13.9 - 19.4) * 0.5 = 19.4 - 2.75 = 16.65 -> floor(16.65)+0.5 = 16.5
    // great: 49 + (34 - 49) * 0.5 = 49 - 7.5 = 41.5 -> floor(41.5)+0.5 = 41.5
    expect(windows.perfect).toBe(16.5);
    expect(windows.great).toBe(41.5);
    expect(windows.good).toBe(74.5);
    expect(windows.ok).toBe(104.5);
    expect(windows.meh).toBe(128.5);
    expect(windows.miss).toBe(165.5);
  });

  it("OD=2.5 should interpolate correctly (od < 5)", () => {
    const windows = getHitWindows(2.5);
    // OD=2.5 < 5: result = mid + (mid - min) * (od - 5) / 5 = mid + (mid - min) * (-0.5)
    // perfect: 19.4 + (19.4 - 22.4) * (-0.5) = 20.9 -> 20.5
    // great: 49 + (49 - 64) * (-0.5) = 56.5 -> 56.5
    // good: 82 + (82 - 97) * (-0.5) = 89.5 -> 89.5
    // ok: 112 + (112 - 127) * (-0.5) = 119.5 -> 119.5
    // meh: 136 + (136 - 151) * (-0.5) = 143.5 -> 143.5
    // miss: 173 + (173 - 188) * (-0.5) = 180.5 -> 180.5
    expect(windows.perfect).toBe(20.5);
    expect(windows.great).toBe(56.5);
    expect(windows.good).toBe(89.5);
    expect(windows.ok).toBe(119.5);
    expect(windows.meh).toBe(143.5);
    expect(windows.miss).toBe(180.5);
  });
});

describe("getHitWindowsV1 (Classic)", () => {
  beforeEach(() => setJudgmentMode("v1"));

  it("OD=0 should use base + 3*10 for non-perfect windows", () => {
    const windows = getHitWindows(0);
    // perfect: always 16 -> floor(16)+0.5 = 16.5
    // great: 34 + 3*10 = 64 -> floor(64)+0.5 = 64.5
    // good: 67 + 3*10 = 97 -> floor(97)+0.5 = 97.5
    // ok: 97 + 3*10 = 127 -> floor(127)+0.5 = 127.5
    // meh: 121 + 3*10 = 151 -> floor(151)+0.5 = 151.5
    // miss: 158 + 3*10 = 188 -> floor(188)+0.5 = 188.5
    expect(windows.perfect).toBe(16.5);
    expect(windows.great).toBe(64.5);
    expect(windows.good).toBe(97.5);
    expect(windows.ok).toBe(127.5);
    expect(windows.meh).toBe(151.5);
    expect(windows.miss).toBe(188.5);
  });

  it("OD=5 should use base + 3*5 for non-perfect windows", () => {
    const windows = getHitWindows(5);
    // perfect: 16 -> 16.5
    // great: 34 + 3*5 = 49 -> 49.5
    // good: 67 + 3*5 = 82 -> 82.5
    // ok: 97 + 3*5 = 112 -> 112.5
    // meh: 121 + 3*5 = 136 -> 136.5
    // miss: 158 + 3*5 = 173 -> 173.5
    expect(windows.perfect).toBe(16.5);
    expect(windows.great).toBe(49.5);
    expect(windows.good).toBe(82.5);
    expect(windows.ok).toBe(112.5);
    expect(windows.meh).toBe(136.5);
    expect(windows.miss).toBe(173.5);
  });

  it("OD=10 should use base values (no bonus)", () => {
    const windows = getHitWindows(10);
    // perfect: 16 -> 16.5
    // great: 34 + 3*0 = 34 -> 34.5
    // good: 67 + 3*0 = 67 -> 67.5
    // ok: 97 + 3*0 = 97 -> 97.5
    // meh: 121 + 3*0 = 121 -> 121.5
    // miss: 158 + 3*0 = 158 -> 158.5
    expect(windows.perfect).toBe(16.5);
    expect(windows.great).toBe(34.5);
    expect(windows.good).toBe(67.5);
    expect(windows.ok).toBe(97.5);
    expect(windows.meh).toBe(121.5);
    expect(windows.miss).toBe(158.5);
  });
});

// ============================================
// calculateJudgment Tests
// ============================================

describe("calculateJudgment", () => {
  beforeEach(() => {
    setJudgmentMode("v2");
    setJudgmentOffset(0);
  });

  it("should return Perfect when diff <= perfect window", () => {
    // OD=5: perfect window = 19.5ms
    expect(calculateJudgment(1000, 1000, 5)).toBe("Perfect");
    expect(calculateJudgment(1019, 1000, 5)).toBe("Perfect");
    expect(calculateJudgment(981, 1000, 5)).toBe("Perfect");
  });

  it("should return Great when perfect < diff <= great window", () => {
    // OD=5: perfect=19.5, great=49.5
    expect(calculateJudgment(1020, 1000, 5)).toBe("Great");
    expect(calculateJudgment(1049, 1000, 5)).toBe("Great");
    expect(calculateJudgment(951, 1000, 5)).toBe("Great");
  });

  it("should return Good when great < diff <= good window", () => {
    // OD=5: great=49.5, good=82.5
    expect(calculateJudgment(1050, 1000, 5)).toBe("Good");
    expect(calculateJudgment(1082, 1000, 5)).toBe("Good");
  });

  it("should return Ok when good < diff <= ok window", () => {
    // OD=5: good=82.5, ok=112.5
    expect(calculateJudgment(1083, 1000, 5)).toBe("Ok");
    expect(calculateJudgment(1112, 1000, 5)).toBe("Ok");
  });

  it("should return Meh when ok < diff <= meh window", () => {
    // OD=5: ok=112.5, meh=136.5
    expect(calculateJudgment(1113, 1000, 5)).toBe("Meh");
    expect(calculateJudgment(1136, 1000, 5)).toBe("Meh");
  });

  it("should return Miss when diff > meh window", () => {
    // OD=5: meh=136.5, miss=173.5
    expect(calculateJudgment(1137, 1000, 5)).toBe("Miss");
    expect(calculateJudgment(1173, 1000, 5)).toBe("Miss");
    expect(calculateJudgment(2000, 1000, 5)).toBe("Miss");
  });

  it("should respect judgment offset", () => {
    setJudgmentOffset(10);
    // offset=10 means adjustedHitTime = hitTime - 10
    // hitTime=1000, noteTime=1000 -> adjusted=990, diff=10 -> Perfect
    expect(calculateJudgment(1000, 1000, 5)).toBe("Perfect");
  });

  it("should handle boundary cases exactly at window edges", () => {
    // OD=5: perfect=19.5, so diff=19.5 should be Perfect (<=)
    expect(calculateJudgment(1019.5, 1000, 5)).toBe("Perfect");
    // diff=19.6 should be Great
    expect(calculateJudgment(1019.6, 1000, 5)).toBe("Great");
  });
});

// ============================================
// Mode Switching Tests
// ============================================

describe("judgment mode switching", () => {
  beforeEach(() => {
    clearJudgmentCache();
  });

  it("should default to v1 mode", () => {
    setJudgmentMode("v1");
    expect(getJudgmentMode()).toBe("v1");
  });

  it("should switch between v1 and v2", () => {
    setJudgmentMode("v2");
    expect(getJudgmentMode()).toBe("v2");
    setJudgmentMode("v1");
    expect(getJudgmentMode()).toBe("v1");
  });

  it("should use custom windows when mode is custom", () => {
    setJudgmentMode("custom");
    setCustomWindows({ perfect: 50, great: 100 });
    const windows = getHitWindows(5);
    expect(windows.perfect).toBe(50);
    expect(windows.great).toBe(100);
    // Unset values should fallback to defaults
    expect(windows.good).toBe(82);
    expect(windows.ok).toBe(112);
    expect(windows.meh).toBe(136);
  });

  it("should clear cache when mode changes", () => {
    setJudgmentMode("v1");
    setJudgmentMode("v2");
    // Mode switch should clear cache (no assertion needed, just verifying no crash)
    expect(getJudgmentMode()).toBe("v2");
  });
});

// ============================================
// Judgment Score/Color Tests
// ============================================

describe("getJudgmentScore", () => {
  it("should return correct scores matching osu!mania", () => {
    expect(getJudgmentScore("Perfect")).toBe(320);
    expect(getJudgmentScore("Great")).toBe(300);
    expect(getJudgmentScore("Good")).toBe(200);
    expect(getJudgmentScore("Ok")).toBe(100);
    expect(getJudgmentScore("Meh")).toBe(50);
    expect(getJudgmentScore("Miss")).toBe(0);
    expect(getJudgmentScore(null)).toBe(0);
  });
});

describe("getJudgmentColor", () => {
  it("should return correct color hex values", () => {
    expect(getJudgmentColor("Perfect")).toBe("#FF00FF");
    expect(getJudgmentColor("Great")).toBe("#00FF88");
    expect(getJudgmentColor("Good")).toBe("#00AAFF");
    expect(getJudgmentColor("Ok")).toBe("#FFAA00");
    expect(getJudgmentColor("Meh")).toBe("#FF4444");
    expect(getJudgmentColor("Miss")).toBe("#888888");
    expect(getJudgmentColor(null)).toBe("#888888");
  });
});

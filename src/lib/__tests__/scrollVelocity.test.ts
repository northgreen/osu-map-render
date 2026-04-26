import { describe, it, expect } from "vitest";
import {
  extractScrollVelocitySegments,
  getScrollVelocityAt,
} from "../scrollVelocity";
import type { TimingPoint } from "../osuParser";

function createTimingPoint(
  time: number,
  beatLength: number,
  uninherited: boolean
): TimingPoint {
  return {
    time,
    beatLength,
    meter: 4,
    sampleSet: 0,
    sampleIndex: 0,
    volume: 0,
    uninherited,
    effects: 0,
  };
}

describe("extractScrollVelocitySegments", () => {
  it("returns default segment for empty timing points", () => {
    const result = extractScrollVelocitySegments([]);
    expect(result).toEqual([{ startTime: 0, scrollVelocity: 1 }]);
  });

  it("handles BPM changes affecting scroll velocity", () => {
    const timingPoints = [
      createTimingPoint(0, 500, true),
      createTimingPoint(1000, 250, true),
    ];
    const result = extractScrollVelocitySegments(timingPoints);
    expect(result).toEqual([
      { startTime: 0, scrollVelocity: 1 },
      { startTime: 1000, scrollVelocity: 2 },
    ]);
  });

  it("returns default segment when beatLength equals -100", () => {
    const timingPoints = [createTimingPoint(0, -100, false)];
    const result = extractScrollVelocitySegments(timingPoints);
    expect(result).toEqual([{ startTime: 0, scrollVelocity: 1 }]);
  });

  it("computes SV=2.0 for beatLength=-50", () => {
    const timingPoints = [createTimingPoint(1000, -50, false)];
    const result = extractScrollVelocitySegments(timingPoints);
    expect(result).toEqual([
      { startTime: 0, scrollVelocity: 1 },
      { startTime: 1000, scrollVelocity: 2 },
    ]);
  });

  it("computes SV=0.5 for beatLength=-200", () => {
    const timingPoints = [createTimingPoint(1000, -200, false)];
    const result = extractScrollVelocitySegments(timingPoints);
    expect(result).toEqual([
      { startTime: 0, scrollVelocity: 1 },
      { startTime: 1000, scrollVelocity: 0.5 },
    ]);
  });

  it("returns correct segments for multiple SV changes", () => {
    const timingPoints = [
      createTimingPoint(0, -100, false),
      createTimingPoint(1000, -50, false),
      createTimingPoint(2000, -200, false),
      createTimingPoint(3000, -25, false),
    ];
    const result = extractScrollVelocitySegments(timingPoints);
    expect(result).toEqual([
      { startTime: 0, scrollVelocity: 1 },
      { startTime: 1000, scrollVelocity: 2 },
      { startTime: 2000, scrollVelocity: 0.5 },
      { startTime: 3000, scrollVelocity: 4 },
    ]);
  });

  it("skips beatLength=0 to avoid division by zero", () => {
    const timingPoints = [
      createTimingPoint(0, -100, false),
      createTimingPoint(1000, 0, false),
      createTimingPoint(2000, -50, false),
    ];
    const result = extractScrollVelocitySegments(timingPoints);
    expect(result).toEqual([
      { startTime: 0, scrollVelocity: 1 },
      { startTime: 2000, scrollVelocity: 2 },
    ]);
  });

  it("treats positive beatLength with uninherited=false as SV=1", () => {
    const timingPoints = [createTimingPoint(1000, 500, false)];
    const result = extractScrollVelocitySegments(timingPoints);
    expect(result).toEqual([{ startTime: 0, scrollVelocity: 1 }]);
  });

  it("combines BPM change with SV change", () => {
    const timingPoints = [
      createTimingPoint(0, 500, true),
      createTimingPoint(1000, 250, true),
      createTimingPoint(2000, -50, false),
    ];
    const result = extractScrollVelocitySegments(timingPoints);
    expect(result).toEqual([
      { startTime: 0, scrollVelocity: 1 },
      { startTime: 1000, scrollVelocity: 2 },
      { startTime: 2000, scrollVelocity: 4 },
    ]);
  });
});

describe("getScrollVelocityAt", () => {
  it("returns 1.0 for empty segments", () => {
    const result = getScrollVelocityAt([], 500);
    expect(result).toBe(1.0);
  });

  it("returns 1.0 for all times with single segment at time 0", () => {
    const segments = [{ startTime: 0, scrollVelocity: 1 }];
    expect(getScrollVelocityAt(segments, 0)).toBe(1.0);
    expect(getScrollVelocityAt(segments, 500)).toBe(1.0);
    expect(getScrollVelocityAt(segments, 10000)).toBe(1.0);
  });

  it("returns correct SV at different times with multiple segments", () => {
    const segments = [
      { startTime: 0, scrollVelocity: 1 },
      { startTime: 1000, scrollVelocity: 2 },
      { startTime: 2000, scrollVelocity: 0.5 },
    ];
    expect(getScrollVelocityAt(segments, 0)).toBe(1);
    expect(getScrollVelocityAt(segments, 500)).toBe(1);
    expect(getScrollVelocityAt(segments, 1000)).toBe(2);
    expect(getScrollVelocityAt(segments, 1500)).toBe(2);
    expect(getScrollVelocityAt(segments, 2000)).toBe(0.5);
    expect(getScrollVelocityAt(segments, 2500)).toBe(0.5);
  });

  it("returns first segment SV for time before first segment", () => {
    const segments = [
      { startTime: 1000, scrollVelocity: 2 },
      { startTime: 2000, scrollVelocity: 0.5 },
    ];
    expect(getScrollVelocityAt(segments, 0)).toBe(2);
    expect(getScrollVelocityAt(segments, 500)).toBe(2);
  });

  it("returns last segment SV for time after last segment", () => {
    const segments = [
      { startTime: 0, scrollVelocity: 1 },
      { startTime: 1000, scrollVelocity: 2 },
      { startTime: 2000, scrollVelocity: 0.5 },
    ];
    expect(getScrollVelocityAt(segments, 3000)).toBe(0.5);
    expect(getScrollVelocityAt(segments, 10000)).toBe(0.5);
  });
});

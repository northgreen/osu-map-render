import { describe, it, expect } from "vitest";
import { getBeatmapDuration, ParsedBeatmap } from "../osuParser";

function createMockBeatmap(
  hitObjects: Partial<ParsedBeatmap["hitObjects"][0]>[],
): ParsedBeatmap {
  return {
    metadata: {
      title: "Test",
      titleUnicode: "Test",
      artist: "Test",
      artistUnicode: "Test",
      creator: "Test",
      version: "Test",
      source: "",
      tags: [],
    },
    difficulty: {
      hpDrainRate: 5,
      circleSize: 4,
      overallDifficulty: 5,
      approachRate: 5,
      sliderMultiplier: 1,
      sliderTickRate: 1,
    },
    timingPoints: [],
    hitObjects: hitObjects.map((h) => ({
      x: 0,
      y: 0,
      time: h.time ?? 0,
      type: 1,
      hitSound: 0,
      objectParams: "",
      hitSample: "",
      column: 0,
      endTime: h.endTime,
      isLongNote: !!h.endTime,
    })),
    audioFile: "",
    mode: 3,
  };
}

// ============================================
// osuParser Tests
// ============================================

describe("getBeatmapDuration", () => {
  it("should return 60000 for empty beatmap", () => {
    const beatmap = createMockBeatmap([]);
    expect(getBeatmapDuration(beatmap)).toBe(60000);
  });

  it("should return duration based on last hit object time + 5000 buffer", () => {
    const beatmap = createMockBeatmap([
      { time: 1000 },
      { time: 5000 },
      { time: 3000 },
    ]);
    // Last object is at time 3000 (array order, not sorted)
    expect(getBeatmapDuration(beatmap)).toBe(8000);
  });

  it("should account for long note end time", () => {
    const beatmap = createMockBeatmap([
      { time: 1000, endTime: 3000 },
      { time: 2000 },
    ]);
    // Last object at time 2000, not a LN -> 2000 + 5000 = 7000
    expect(getBeatmapDuration(beatmap)).toBe(7000);
  });

  it("should use LN end time for last object", () => {
    const beatmap = createMockBeatmap([
      { time: 1000 },
      { time: 2000, endTime: 5000 },
    ]);
    // Last object is LN ending at 5000 -> 5000 + 5000 = 10000
    expect(getBeatmapDuration(beatmap)).toBe(10000);
  });
});

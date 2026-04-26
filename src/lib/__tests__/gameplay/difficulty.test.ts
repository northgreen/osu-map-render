import { describe, it, expect, beforeEach } from "vitest";
import { calculateDifficulty, calculateRealtimePP } from "../../difficulty";
import { HitObject } from "../../osuParser";

// ============================================
// Difficulty Calculation Tests
// ============================================

function createTestBeatmap(
  noteCount: number,
  keyCount: number = 4,
  od: number = 5,
  hasLongNotes: boolean = false,
) {
  const hitObjects: HitObject[] = [];
  for (let i = 0; i < noteCount; i++) {
    const isLN = hasLongNotes && i % 3 === 0;
    hitObjects.push({
      x: (i % keyCount) * 128,
      y: 256,
      time: i * 500, // 500ms apart = 120 BPM
      type: isLN ? 128 : 1,
      hitSound: 0,
      objectParams: "",
      hitSample: "",
      column: i % keyCount,
      endTime: isLN ? i * 500 + 1000 : undefined,
      isLongNote: isLN,
    });
  }

  return {
    hitObjects,
    difficulty: {
      overallDifficulty: od,
      circleSize: keyCount,
      approachRate: 5,
      hpDrainRate: 5,
    },
  };
}

describe("calculateDifficulty", () => {
  beforeEach(() => {
    // Clear cache between tests
    calculateDifficulty(createTestBeatmap(1));
  });

  it("should return 0 stars for empty beatmap", () => {
    const beatmap = createTestBeatmap(0);
    const result = calculateDifficulty(beatmap);
    expect(result.stars).toBe(0);
    expect(result.maxCombo).toBe(0);
    expect(result.difficulty).toBe(0);
  });

  it("should calculate difficulty for a simple beatmap", () => {
    const beatmap = createTestBeatmap(100, 4, 5);
    const result = calculateDifficulty(beatmap);
    expect(result.stars).toBeGreaterThan(0);
    expect(result.maxCombo).toBe(100);
    expect(result.difficulty).toBeGreaterThanOrEqual(0);
  });

  it("should return correct maxCombo", () => {
    const beatmap = createTestBeatmap(50, 4, 5);
    const result = calculateDifficulty(beatmap);
    expect(result.maxCombo).toBe(50);
  });

  it("should return ppComponents structure", () => {
    const beatmap = createTestBeatmap(100, 4, 5);
    const result = calculateDifficulty(beatmap);
    expect(result.ppComponents).toHaveProperty("difficulty");
  });

  it("should cache results for same beatmap", () => {
    const beatmap = createTestBeatmap(100, 4, 5);
    const result1 = calculateDifficulty(beatmap);
    const result2 = calculateDifficulty(beatmap);
    expect(result1).toBe(result2); // Same reference (cached)
  });

  it("should not cache when replayData is provided", () => {
    const beatmap = createTestBeatmap(100, 4, 5);
    const result1 = calculateDifficulty(beatmap);
    const result2 = calculateDifficulty(beatmap, { hitResults: [] });
    expect(result1).not.toBe(result2); // Different references
  });
});

// ============================================
// Real-time PP Calculation Tests
// ============================================

describe("calculateRealtimePP", () => {
  it("should return 0 for perfect accuracy with no combo", () => {
    const beatmap = createTestBeatmap(100, 4, 5);
    const pp = calculateRealtimePP(beatmap, 0, 0, {
      countPerfect: 0,
      countGreat: 0,
      countGood: 0,
      countOk: 0,
      countMeh: 0,
      countMiss: 0,
    });
    // With 0 hits, accuracy = 0, so accuracyFactor = max(0, 5*0 - 4) = 0
    expect(pp).toBe(0);
  });

  it("should increase PP with more hits", () => {
    const beatmap = createTestBeatmap(100, 4, 5);
    const pp1 = calculateRealtimePP(beatmap, 0, 50, {
      countPerfect: 50,
      countGreat: 0,
      countGood: 0,
      countOk: 0,
      countMeh: 0,
      countMiss: 0,
    });
    const pp2 = calculateRealtimePP(beatmap, 0, 100, {
      countPerfect: 100,
      countGreat: 0,
      countGood: 0,
      countOk: 0,
      countMeh: 0,
      countMiss: 0,
    });
    expect(pp2).toBeGreaterThan(pp1);
  });

  it("should decrease PP with misses", () => {
    const beatmap = createTestBeatmap(100, 4, 5);
    const ppNoMiss = calculateRealtimePP(beatmap, 0, 100, {
      countPerfect: 100,
      countGreat: 0,
      countGood: 0,
      countOk: 0,
      countMeh: 0,
      countMiss: 0,
    });
    const ppWithMiss = calculateRealtimePP(beatmap, 0, 100, {
      countPerfect: 90,
      countGreat: 0,
      countGood: 0,
      countOk: 0,
      countMeh: 0,
      countMiss: 10,
    });
    expect(ppWithMiss).toBeLessThan(ppNoMiss);
  });

  it("should handle empty beatmap", () => {
    const beatmap = createTestBeatmap(0);
    const pp = calculateRealtimePP(beatmap, 0, 0, {
      countPerfect: 0,
      countGreat: 0,
      countGood: 0,
      countOk: 0,
      countMeh: 0,
      countMiss: 0,
    });
    expect(pp).toBe(0);
  });
});

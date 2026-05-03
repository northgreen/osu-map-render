import { HitObject } from "./osuParser";

// ============================================
// osu!mania Difficulty Calculator (Approximation)
// ============================================

export interface DifficultyResult {
  stars: number;
  maxCombo: number;
  difficulty: number;
  total: number;
  ppComponents: {
    difficulty: number;
  };
}

// ============================================
// Star Rating Calculation (Density-based)
// ============================================

function calculateStarRating(
  hitObjects: HitObject[],
  totalColumns: number,
): number {
  if (hitObjects.length === 0) return 0;

  const sorted = [...hitObjects].sort((a, b) => a.time - b.time);

  // Calculate average delta time between notes
  let totalDelta = 0;
  for (let i = 1; i < sorted.length; i++) {
    totalDelta += sorted[i].time - sorted[i - 1].time;
  }
  const avgDelta = totalDelta / (sorted.length - 1);

  // Notes per second
  const notesPerSecond = avgDelta > 0 ? 1000 / avgDelta : 0;

  // LN ratio
  const lnCount = sorted.filter((n) => n.isLongNote).length;
  const lnRatio = lnCount / sorted.length;

  // Column distribution (balance)
  const colCounts = new Array(totalColumns).fill(0);
  sorted.forEach((n) => colCounts[n.column]++);
  const maxCol = Math.max(...colCounts);
  const minCol = Math.min(...colCounts.filter((c) => c > 0));
  const balance = maxCol / (minCol || 1);

  // Combined formula
  const baseSR = Math.sqrt(notesPerSecond / totalColumns) * 2.65;
  const lnBonus = 1 + lnRatio * 0.33;
  const balanceFactor = 1 + (balance - 1) * 0.12;

  return baseSR * lnBonus * balanceFactor;
}

// ============================================
// Main API
// ============================================

let difficultyCache: DifficultyResult | null = null;
let lastBeatmapHash: string | null = null;

function hashBeatmap(beatmap: {
  hitObjects: HitObject[];
  difficulty: {
    overallDifficulty: number;
    circleSize: number;
    approachRate?: number;
    hpDrainRate?: number;
  };
}): string {
  return `${beatmap.hitObjects.length}-${beatmap.difficulty.circleSize}-${beatmap.difficulty.overallDifficulty}`;
}

export function calculateDifficulty(
  beatmap: {
    hitObjects: HitObject[];
    difficulty: {
      overallDifficulty: number;
      circleSize: number;
      approachRate?: number;
      hpDrainRate?: number;
    };
  },
  replayData?: { hitResults: number[] },
): DifficultyResult {
  const hash = hashBeatmap(beatmap);
  if (!replayData && difficultyCache && lastBeatmapHash === hash) {
    return difficultyCache;
  }

  const { hitObjects, difficulty } = beatmap;
  const keyCount = Math.max(4, difficulty.circleSize);

  const starRating = calculateStarRating(hitObjects, keyCount);
  const maxCombo = calculateMaxCombo(hitObjects);
  const ppResult = calculatePP(beatmap, maxCombo, starRating, replayData);

  const result = {
    stars: Math.round(starRating * 100) / 100,
    maxCombo,
    difficulty: ppResult.difficulty,
    total: ppResult.total,
    ppComponents: ppResult.components,
  };

  if (!replayData) {
    difficultyCache = result;
    lastBeatmapHash = hash;
  }

  return result;
}

function calculateMaxCombo(hitObjects: HitObject[]): number {
  if (hitObjects.length === 0) return 0;
  return hitObjects.length;
}

// ============================================
// PP Calculation (osu!mania formula)
// ============================================

/**
 * osu!mania PP calculation based on ManiaPerformanceCalculator.cs
 *
 * Formula:
 *   difficultyValue = 8.0 * pow(max(stars - 0.15, 0.05), 2.2)
 *                   * max(0, 5 * accuracy - 4)
 *                   * (1 + 0.1 * min(1, totalHits / 1500))
 *
 * Accuracy uses mania weights: Perfect=320, Great=300, Good=200, Ok=100, Meh=50
 */
function calculatePP(
  beatmap: {
    hitObjects: HitObject[];
    difficulty: { overallDifficulty: number; circleSize: number };
  },
  maxCombo: number,
  stars: number,
  replayData?: { hitResults: number[] },
): {
  total: number;
  difficulty: number;
  components: { difficulty: number };
} {
  const hitObjects = beatmap.hitObjects;
  const totalNotes = hitObjects.length;

  if (totalNotes === 0) {
    return { total: 0, difficulty: 0, components: { difficulty: 0 } };
  }

  // Parse hit results into mania judgment counts
  // hitResults uses osu!mania values: 320=Perfect, 300=Great, 200=Good, 100=Ok, 50=Meh, 0=Miss
  let countPerfect = 0;
  let countGreat = 0;
  let countGood = 0;
  let countOk = 0;
  let countMeh = 0;
  let countMiss = 0;

  if (replayData?.hitResults) {
    for (const result of replayData.hitResults) {
      if (result === 320) countPerfect++;
      else if (result === 300) countGreat++;
      else if (result === 200) countGood++;
      else if (result === 100) countOk++;
      else if (result === 50) countMeh++;
      else countMiss++;
    }
  } else {
    // Default: all Perfect
    countPerfect = totalNotes;
  }

  const totalHits =
    countPerfect + countGreat + countGood + countOk + countMeh + countMiss;

  // osu!mania accuracy calculation (ManiaPerformanceCalculator.cs:72-78)
  const accuracy =
    totalHits > 0
      ? (countPerfect * 320 +
          countGreat * 300 +
          countGood * 200 +
          countOk * 100 +
          countMeh * 50) /
        (totalHits * 320)
      : 0;

  // osu!mania PP formula (ManiaPerformanceCalculator.cs:60-62)
  // difficultyValue = 8.0 * pow(max(stars - 0.15, 0.05), 2.2)
  //                 * max(0, 5 * accuracy - 4)
  //                 * (1 + 0.1 * min(1, totalHits / 1500))
  const starRatingFactor = 8.0 * Math.pow(Math.max(stars - 0.15, 0.05), 2.2);
  const accuracyFactor = Math.max(0, 5 * accuracy - 4);
  const lengthFactor = 1 + 0.1 * Math.min(1, totalHits / 1500);

  const difficultyValue = starRatingFactor * accuracyFactor * lengthFactor;
  const total = Math.round(difficultyValue);

  return {
    total,
    difficulty: Math.round(difficultyValue),
    components: {
      difficulty: Math.round(difficultyValue),
    },
  };
}

// Real-time PP calculation (osu!mania formula)
export function calculateRealtimePP(
  beatmap: {
    hitObjects: HitObject[];
    difficulty: {
      overallDifficulty: number;
      circleSize: number;
      approachRate?: number;
      hpDrainRate?: number;
    };
  },
  currentTime: number,
  currentCombo: number,
  judgmentCounts: {
    countPerfect: number;
    countGreat: number;
    countGood: number;
    countOk: number;
    countMeh: number;
    countMiss: number;
  },
): number {
  const stars = calculateDifficulty(beatmap).stars;

  const {
    countPerfect,
    countGreat,
    countGood,
    countOk,
    countMeh,
    countMiss,
  } = judgmentCounts;

  const totalHits =
    countPerfect + countGreat + countGood + countOk + countMeh + countMiss;

  // osu!mania accuracy calculation
  const accuracy =
    totalHits > 0
      ? (countPerfect * 320 +
          countGreat * 300 +
          countGood * 200 +
          countOk * 100 +
          countMeh * 50) /
        (totalHits * 320)
      : 0;

  // osu!mania PP formula
  const starRatingFactor = 8.0 * Math.pow(Math.max(stars - 0.15, 0.05), 2.2);
  const accuracyFactor = Math.max(0, 5 * accuracy - 4);
  const lengthFactor = 1 + 0.1 * Math.min(1, totalHits / 1500);

  const difficultyValue = starRatingFactor * accuracyFactor * lengthFactor;
  return Math.round(difficultyValue);
}

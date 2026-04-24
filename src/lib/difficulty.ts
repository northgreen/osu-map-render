import { HitObject } from "./osuParser";

// ============================================
// osu!mania Difficulty Calculator (Approximation)
// ============================================

export interface DifficultyResult {
  stars: number;
  maxCombo: number;
  pp: number;
  ppComponents: {
    aim: number;
    speed: number;
    accuracy: number;
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
    pp: ppResult.total,
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
// PP Calculation
// ============================================

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
  components: { aim: number; speed: number; accuracy: number };
} {
  const hitObjects = beatmap.hitObjects;
  const totalNotes = hitObjects.length;

  if (totalNotes === 0) {
    return { total: 0, components: { aim: 0, speed: 0, accuracy: 0 } };
  }

  let count300 = totalNotes;
  let count100 = 0;
  let count50 = 0;

  if (replayData?.hitResults) {
    count300 = replayData.hitResults.filter((r) => r === 300).length;
    count100 = replayData.hitResults.filter((r) => r === 100).length;
    count50 = replayData.hitResults.filter((r) => r === 50).length;
  }

  const accuracy =
    (count300 * 300 + count100 * 100 + count50 * 50) / (totalNotes * 300);

  const aimPP = stars * 0.8 * (1 + accuracy * 0.5);
  const speedPP = stars * 0.5 * accuracy;
  const accPP = accuracy * accuracy * 100;

  const comboMultiplier = Math.min(1, maxCombo / 500);
  const total = Math.round((aimPP + speedPP + accPP) * comboMultiplier);

  return {
    total,
    components: {
      aim: Math.round(aimPP),
      speed: Math.round(speedPP),
      accuracy: Math.round(accPP),
    },
  };
}

// Real-time PP calculation
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
    count300: number;
    count100: number;
    count50: number;
    countMiss: number;
  },
): number {
  const { hitObjects } = beatmap;
  const stars = calculateDifficulty(beatmap).stars;

  const totalNotes = hitObjects.length;
  const totalScore =
    judgmentCounts.count300 * 300 +
    judgmentCounts.count100 * 100 +
    judgmentCounts.count50 * 50;
  const maxPossibleScore = totalNotes * 300;
  const accuracy = maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;

  const aimPP = stars * 0.8 * (1 + accuracy * 0.5);
  const speedPP = stars * 0.5 * accuracy;
  const accPP = accuracy * accuracy * 100;

  const comboMultiplier = Math.min(1, currentCombo / 500);
  return Math.round((aimPP + speedPP + accPP) * comboMultiplier);
}

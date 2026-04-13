import { HitObject } from "./osuParser";

// Calculate mania difficulty rating (simplified)
// Based on: note density, rhythm complexity, key count
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

// Hit window definitions for osu!mania (in ms)
const HIT_WINDOW_300 = [80, 50, 30, 20]; // For OD 0-10
const HIT_WINDOW_100 = [160, 100, 60, 40];
const HIT_WINDOW_50 = [240, 150, 90, 60];

function getHitWindow(od: number, hit300: boolean): number {
  const idx = Math.min(10, Math.max(0, Math.round(od)));
  const window = hit300 ? HIT_WINDOW_300 : HIT_WINDOW_100;
  const base = window[Math.floor(idx / 3)];
  const next = window[Math.min(3, Math.ceil(idx / 3))];
  return base + (next - base) * (idx % 3 / 3);
}

// Calculate strain for mania (simplified)
// Higher density and longer notes = more difficulty
function calculateStrain(hitObjects: HitObject[], keyCount: number): number {
  if (hitObjects.length === 0) return 0;

  let totalStrain = 0;
  let previousTime = 0;

  // Count notes per column
  const columnCounts = new Array(keyCount).fill(0);

  for (const obj of hitObjects) {
    const col = Math.min(keyCount - 1, obj.column);
    columnCounts[col]++;

    const time = obj.time;
    const delta = time - previousTime;

    // Shorter deltas = higher strain
    if (delta > 0 && delta < 1000) {
      totalStrain += 100 / Math.sqrt(delta);
    }

    // LN adds extra strain
    if (obj.isLongNote && obj.endTime) {
      const lnDuration = obj.endTime - obj.time;
      totalStrain += lnDuration / 100;
    }

    previousTime = time;
  }

  // Calculate column balance (unbalanced = harder)
  const maxCol = Math.max(...columnCounts);
  const minCol = Math.min(...columnCounts.filter(c => c > 0));
  const balance = minCol > 0 ? 1 + (maxCol - minCol) / columnCounts.reduce((a, b) => a + b, 0) : 1;

  return totalStrain * balance / hitObjects.length;
}

export function calculateDifficulty(beatmap: {
  hitObjects: HitObject[];
  difficulty: {
    overallDifficulty: number;
    circleSize: number;
    approachRate: number;
    hpDrainRate: number;
  };
}, replayData?: { hitResults: number[] }): DifficultyResult {
  const { hitObjects, difficulty } = beatmap;
  const keyCount = Math.max(4, difficulty.circleSize);

  // Calculate total possible score for each hit result type
  const maxScore300 = hitObjects.length * 300;
  const maxScore100 = hitObjects.length * 100;
  const maxScore50 = hitObjects.length * 50;

  // If we have replay data, use actual hit results
  let count300 = hitObjects.length;
  let count100 = 0;
  let count50 = 0;
  let countMiss = 0;

  if (replayData?.hitResults) {
    count300 = replayData.hitResults.filter(r => r === 300).length;
    count100 = replayData.hitResults.filter(r => r === 100).length;
    count50 = replayData.hitResults.filter(r => r === 50).length;
    countMiss = replayData.hitResults.filter(r => r === 0).length;
  }

  // Calculate max combo
  const maxCombo = calculateMaxCombo(hitObjects);

  // Calculate strain
  const strain = calculateStrain(hitObjects, keyCount);

  // Star rating formula (simplified)
  // Based on: strain * keyCount * od factor
  const odFactor = 1 + (10 - difficulty.overallDifficulty) / 10;
  const baseStars = strain * Math.sqrt(keyCount) * 0.015 * odFactor;
  const stars = Math.min(10, baseStars);

  // PP calculation (simplified)
  const accuracy = (count300 * 300 + count100 * 100 + count50 * 50) / (hitObjects.length * 300);

  // Aim (mostly based on key count and density)
  const aimPP = stars * 0.8 * (1 + accuracy * 0.5);

  // Speed (based on note density)
  const speedPP = stars * 0.5 * accuracy;

  // Accuracy bonus
  const accPP = accuracy * accuracy * 100;

  // Apply combo multiplier
  const comboMultiplier = Math.min(1, maxCombo / 500);
  const pp = (aimPP + speedPP + accPP) * comboMultiplier;

  return {
    stars: Math.round(stars * 10) / 10,
    maxCombo,
    pp: Math.round(pp),
    ppComponents: {
      aim: Math.round(aimPP),
      speed: Math.round(speedPP),
      accuracy: Math.round(accPP),
    }
  };
}

function calculateMaxCombo(hitObjects: HitObject[]): number {
  if (hitObjects.length === 0) return 0;

  let currentCombo = 0;
  let maxCombo = 0;
  let timeSinceLastNote = 0;

  for (let i = 0; i < hitObjects.length; i++) {
    const obj = hitObjects[i];
    const time = obj.time;

    // Reset combo on miss (assuming no breaks > 2 seconds)
    if (i > 0 && time - hitObjects[i - 1].time > 2000) {
      currentCombo = 0;
    }

    currentCombo++;
    maxCombo = Math.max(maxCombo, currentCombo);

    // For LN, count end time as separate "hit"
    if (obj.isLongNote && obj.endTime) {
      if (i + 1 < hitObjects.length && obj.endTime < hitObjects[i + 1].time - 2000) {
        // LN ended during a break
      } else {
        currentCombo++;
        maxCombo = Math.max(maxCombo, currentCombo);
      }
    }
  }

  return maxCombo;
}

// Calculate real-time PP based on current combo and accuracy
export function calculateRealtimePP(
  beatmap: { hitObjects: HitObject[]; difficulty: { overallDifficulty: number; circleSize: number } },
  currentTime: number,
  currentCombo: number,
  hitResults: { count300: number; count100: number; count50: number; countMiss: number }
): number {
  const { hitObjects, difficulty } = beatmap;
  const totalHits = hitObjects.length;
  const completedHits = hitResults.count300 + hitResults.count100 + hitResults.count50 + hitResults.countMiss;

  if (completedHits === 0) return 0;

  const accuracy = (hitResults.count300 * 300 + hitResults.count100 * 100 + hitResults.count50 * 50) / (completedHits * 300);
  const baseStars = calculateStrain(hitObjects, difficulty.circleSize) * Math.sqrt(difficulty.circleSize) * 0.015;

  // Scale by progress
  const progress = completedHits / totalHits;
  const comboMultiplier = Math.min(1, currentCombo / 500);

  const pp = baseStars * 50 * accuracy * comboMultiplier * progress;

  return Math.round(pp);
}
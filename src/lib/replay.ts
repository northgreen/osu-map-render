import replayData from "./replay.json";

export interface ReplayFrame {
  timeOffset: number;
  x: number;
  y: number;
  keys: number;
}

export interface ReplayInfo {
  mode: number;
  gameVersion: number;
  beatmapHash: string;
  playerName: string;
  replayHash: string;
  count300: number;
  count100: number;
  count50: number;
  countGeki: number;
  countKatu: number;
  countMiss: number;
  totalScore: number;
  maxCombo: number;
  perfect: boolean;
  mods: number;
  lifeData: { time: number; life: number }[];
  timestamp: number;
  replayData: ReplayFrame[];
  onlineScoreId: number;
}

export const replay: ReplayInfo = replayData as ReplayInfo;

// Key constants
export const KEY_M1 = 1;
export const KEY_M2 = 2;
export const KEY_K1 = 4;
export const KEY_K2 = 8;
export const KEY_SMOKE = 16;

// Convert replay frames to a time-indexed map for fast lookup
export function buildReplayFrameMap(replay: ReplayInfo): Map<number, ReplayFrame[]> {
  const map = new Map<number, ReplayFrame[]>();
  let cumulativeTime = 0;

  for (const frame of replay.replayData) {
    cumulativeTime += frame.timeOffset;
    const existing = map.get(cumulativeTime) || [];
    existing.push({ ...frame, timeOffset: cumulativeTime });
    map.set(cumulativeTime, existing);
  }

  return map;
}

// Get the cumulative time for each frame (for faster lookup)
export function buildCumulativeTimes(replay: ReplayInfo): number[] {
  const times: number[] = [];
  let cumulativeTime = 0;

  for (const frame of replay.replayData) {
    cumulativeTime += frame.timeOffset;
    times.push(cumulativeTime);
  }

  return times;
}
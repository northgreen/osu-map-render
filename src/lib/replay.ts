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

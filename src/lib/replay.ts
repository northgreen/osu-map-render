import { z } from "zod";
import replayData from "../generated/replay.json";

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

const replaySchema = z.object({
  mode: z.number(),
  gameVersion: z.number(),
  beatmapHash: z.string(),
  playerName: z.string(),
  replayHash: z.string(),
  count300: z.number(),
  count100: z.number(),
  count50: z.number(),
  countGeki: z.number(),
  countKatu: z.number(),
  countMiss: z.number(),
  totalScore: z.number(),
  maxCombo: z.number(),
  perfect: z.boolean(),
  mods: z.number(),
  lifeData: z.array(z.object({
    time: z.number(),
    life: z.number(),
  })),
  timestamp: z.number(),
  replayData: z.array(z.object({
    timeOffset: z.number(),
    x: z.number(),
    y: z.number(),
    keys: z.number(),
  })),
  onlineScoreId: z.number(),
});

export const replay: ReplayInfo = replaySchema.parse(replayData) as ReplayInfo;

// Check if replay exists and is valid
export function hasReplay(): boolean {
  return !!(replay?.replayData && replay.replayData.length > 0);
}

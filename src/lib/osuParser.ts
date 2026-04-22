import beatmapData from "./beatmap.json";

export interface BeatmapMetadata {
  title: string;
  titleUnicode: string;
  artist: string;
  artistUnicode: string;
  creator: string;
  version: string;
  source: string;
  tags: string[];
}

export interface BeatmapDifficulty {
  hpDrainRate: number;
  circleSize: number;
  overallDifficulty: number;
  approachRate: number;
  sliderMultiplier: number;
  sliderTickRate: number;
}

export interface TimingPoint {
  time: number;
  beatLength: number;
  meter: number;
  sampleSet: number;
  sampleIndex: number;
  volume: number;
  uninherited: boolean;
  effects: number;
}

export interface HitObject {
  x: number;
  y: number;
  time: number;
  type: number;
  hitSound: number;
  objectParams: string;
  hitSample: string;
  column: number;
  endTime?: number;
  isLongNote: boolean;
}

export interface ParsedBeatmap {
  metadata: BeatmapMetadata;
  difficulty: BeatmapDifficulty;
  timingPoints: TimingPoint[];
  hitObjects: HitObject[];
  audioFile: string;
  mode: number;
  backgroundImage?: string;
}

// Export the pre-loaded beatmap data
export const beatmap: ParsedBeatmap = beatmapData as ParsedBeatmap;

export function getBeatmapDuration(beatmap: ParsedBeatmap): number {
  if (beatmap.hitObjects.length === 0) return 60000;
  const lastNote = beatmap.hitObjects[beatmap.hitObjects.length - 1];
  const endTime =
    lastNote.isLongNote && lastNote.endTime ? lastNote.endTime : lastNote.time;
  return endTime + 5000;
}

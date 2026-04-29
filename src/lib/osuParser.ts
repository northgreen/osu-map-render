import beatmapData from "../generated/beatmap.json";
import type { ScrollVelocitySegment } from "./scrollVelocity";

/**
 * Beatmap metadata section - stores title, artist, creator, and tags.
 * Parsed from the `[Metadata]` section of a .osu file.
 */
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

/**
 * Beatmap difficulty attributes - HP drain, circle size, OD, AR, and slider settings.
 * Parsed from the `[Difficulty]` section of a .osu file.
 */
export interface BeatmapDifficulty {
  hpDrainRate: number;
  circleSize: number;
  overallDifficulty: number;
  approachRate: number;
  sliderMultiplier: number;
  sliderTickRate: number;
}

/**
 * A timing point defining beat length, time signature, and sample settings at a specific time.
 * Parsed from the `[TimingPoints]` section. `uninherited=true` sets BPM; `uninherited=false`
 * controls scroll velocity multiplier.
 */
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

/**
 * Parsed hit sample data from the hitSample field of a hit object.
 * Format: "normalSet:additionSet:index:volume:filename"
 */
export interface HitSample {
  normalSet: number;
  additionSet: number;
  index: number;
  volume: number;
  filename: string;
}

/**
 * Parse the hitSample string field into a structured HitSample object.
 *
 * Format: "normalSet:additionSet:index:volume:filename"
 * Returns undefined for empty or malformed strings.
 */
export function parseHitSample(hitSample: string): HitSample | undefined {
  if (!hitSample || hitSample.trim() === "") return undefined;

  const parts = hitSample.split(":");
  if (parts.length < 2) return undefined;

  return {
    normalSet: parseInt(parts[0], 10) || 0,
    additionSet: parseInt(parts[1], 10) || 0,
    index: parseInt(parts[2], 10) || 0,
    volume: parseInt(parts[3], 10) || 0,
    filename: parts[4] || "",
  };
}

/**
 * Create a default HitSample with all zeros (inherits from timing point).
 */
export function createDefaultHitSample(): HitSample {
  return {
    normalSet: 0,
    additionSet: 0,
    index: 0,
    volume: 0,
    filename: "",
  };
}

/**
 * A single hit object (note) in the beatmap.
 * Parsed from the `[HitObjects]` section. For mania, `column` is computed from `x` position.
 * `isLongNote` and `endTime` apply to hold notes (type bit 128).
 */
export interface HitObject {
  x: number;
  y: number;
  time: number;
  type: number;
  hitSound: number;
  hitSample: string;
  parsedHitSample?: HitSample;
  column: number;
  endTime?: number;
  isLongNote: boolean;
}

/**
 * Fully parsed beatmap data, combining metadata, difficulty, timing points, and hit objects.
 * This is the primary data structure used throughout the renderer.
 */
export interface ParsedBeatmap {
  metadata: BeatmapMetadata;
  difficulty: BeatmapDifficulty;
  timingPoints: TimingPoint[];
  hitObjects: HitObject[];
  audioFile: string;
  mode: number;
  backgroundImage?: string;
  scrollVelocitySegments?: ScrollVelocitySegment[];
  fileHash?: string;
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

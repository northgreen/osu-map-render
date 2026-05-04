// osu!mania renderer configuration
// Modify these values to adjust the rendering

// ============================================
// Base Configuration
// ============================================

// Scroll speed - determines how fast notes fall
// Common values: 10 (slow), 15, 20 (default), 25, 30, 40 (fast)
export const SCROLL_SPEED = 37;

// Base visible time at scroll speed 10 (in milliseconds)
export const BASE_VISIBLE_TIME = 1800;

// Note dimensions
export const NOTE_WIDTH = 100;
export const NOTE_HEIGHT = 40;

// Stage dimensions (for rendering background)
export const STAGE_X = 64;
export const STAGE_WIDTH_BASE = 512;
export const JUDGMENT_LINE_Y = 900;

// Hit effect duration (in milliseconds)
export const HIT_EFFECT_DURATION = 30;

// ============================================
// Key Count Configuration (1K - 18K + Wildcard)
// ============================================

// Color palettes for each key count
const COLUMN_COLORS_MAP: Record<number, string[]> = {
  1: ["#FF6B6B"],
  2: ["#FF6B6B", "#4ECDC4"],
  3: ["#FF6B6B", "#FFD93D", "#FF6B6B"],
  4: ["#FF6B6B", "#4ECDC4", "#4ECDC4", "#FF6B6B"],
  5: ["#FF6B6B", "#FF8E53", "#4ECDC4", "#FF8E53", "#FF6B6B"],
  6: ["#FF6B6B", "#4ECDC4", "#FF6B6B", "#FF6B6B", "#4ECDC4", "#FF6B6B"],
  7: ["#FF6B6B", "#FF8E53", "#FFD93D", "#4ECDC4", "#FFD93D", "#FF8E53", "#FF6B6B"],
  8: ["#FF6B6B", "#FF8E53", "#FFD93D", "#6BCB77", "#6BCB77", "#FFD93D", "#FF8E53", "#FF6B6B"],
  9: ["#FF6B6B", "#FF8E53", "#FFD93D", "#6BCB77", "#45B7D1", "#6BCB77", "#FFD93D", "#FF8E53", "#FF6B6B"],
  10: ["#FF6B6B", "#FF8E53", "#FFD93D", "#6BCB77", "#45B7D1", "#45B7D1", "#6BCB77", "#FFD93D", "#FF8E53", "#FF6B6B"],
  11: ["#FF6B6B", "#FF8E53", "#FFD93D", "#6BCB77", "#45B7D1", "#6C5CE7", "#45B7D1", "#6BCB77", "#FFD93D", "#FF8E53", "#FF6B6B"],
  12: ["#FF6B6B", "#FF8E53", "#FFD93D", "#6BCB77", "#45B7D1", "#6C5CE7", "#6C5CE7", "#45B7D1", "#6BCB77", "#FFD93D", "#FF8E53", "#FF6B6B"],
  13: ["#FF6B6B", "#FF8E53", "#FFD93D", "#6BCB77", "#45B7D1", "#6C5CE7", "#A29BFE", "#6C5CE7", "#45B7D1", "#6BCB77", "#FFD93D", "#FF8E53", "#FF6B6B"],
  14: ["#FF6B6B", "#FF8E53", "#FFD93D", "#6BCB77", "#45B7D1", "#6C5CE7", "#A29BFE", "#A29BFE", "#6C5CE7", "#45B7D1", "#6BCB77", "#FFD93D", "#FF8E53", "#FF6B6B"],
  15: ["#FF6B6B", "#FF8E53", "#FFD93D", "#6BCB77", "#45B7D1", "#6C5CE7", "#A29BFE", "#F368E0", "#A29BFE", "#6C5CE7", "#45B7D1", "#6BCB77", "#FFD93D", "#FF8E53", "#FF6B6B"],
  16: ["#FF6B6B", "#FF8E53", "#FFD93D", "#6BCB77", "#45B7D1", "#6C5CE7", "#A29BFE", "#F368E0", "#F368E0", "#A29BFE", "#6C5CE7", "#45B7D1", "#6BCB77", "#FFD93D", "#FF8E53", "#FF6B6B"],
  17: ["#FF6B6B", "#FF8E53", "#FFD93D", "#6BCB77", "#45B7D1", "#6C5CE7", "#A29BFE", "#F368E0", "#FF9FF3", "#F368E0", "#A29BFE", "#6C5CE7", "#45B7D1", "#6BCB77", "#FFD93D", "#FF8E53", "#FF6B6B"],
  18: ["#FF6B6B", "#FF8E53", "#FFD93D", "#6BCB77", "#45B7D1", "#6C5CE7", "#A29BFE", "#F368E0", "#FF9FF3", "#FF9FF3", "#F368E0", "#A29BFE", "#6C5CE7", "#45B7D1", "#6BCB77", "#FFD93D", "#FF8E53", "#FF6B6B"],
};

// Wildcard fallback for key counts > 18
const COLUMN_COLORS_WILDCARD = [
  "#FF6B6B", "#FF8E53", "#FFD93D", "#6BCB77",
  "#45B7D1", "#6C5CE7", "#A29BFE", "#F368E0",
  "#FF9FF3", "#54A0FF", "#5F27CD", "#01CD82",
  "#05C46B", "#F3B2B4", "#D980FA", "#B53471",
  "#12CBC4", "#FDA7DF", "#ED4C67", "#F79F1F"
];

// ============================================
// Position Generation (DRY)
// ============================================

/**
 * Compute the stage width for a given key count.
 *
 * For 1-4K the stage stays at `STAGE_WIDTH_BASE`. From 5K onward the stage
 * expands proportionally: each additional key adds `STAGE_WIDTH_BASE / 4`
 * pixels. This mirrors the osu!mania UI where more columns need more room.
 */
function computeStageWidth(keyCount: number): number {
  return keyCount <= 4
    ? STAGE_WIDTH_BASE
    : STAGE_WIDTH_BASE + (keyCount - 4) * (STAGE_WIDTH_BASE / 4);
}

/**
 * Generate column center positions (relative to stage left edge).
 * Used for judgment lines, dividers, and key indicators.
 */
function generateStagePositions(keyCount: number): number[] {
  const stageWidth = computeStageWidth(keyCount);
  const columnWidth = stageWidth / keyCount;
  return Array.from({ length: keyCount }, (_, i) => columnWidth * (i + 0.5));
}

/**
 * Generate note left-edge positions (relative to stage left edge).
 * Notes are centered within each column, offset by `NOTE_WIDTH`.
 */
function generateNotePositions(keyCount: number): number[] {
  const stageWidth = computeStageWidth(keyCount);
  const columnWidth = stageWidth / keyCount;
  return Array.from(
    { length: keyCount },
    (_, i) => columnWidth * i + (columnWidth - NOTE_WIDTH) / 2,
  );
}

// ============================================
// Pre-computed Position Maps (1K - 18K)
// ============================================

/**
 * Pre-computed stage positions for 1K-18K. Using a static map avoids
 * regenerating arrays on every render frame. Key counts > 18 fall back
 * to `generateWildcardPositions` which computes on demand.
 *
 * The wildcard fallback uses the same 20-color palette (`COLUMN_COLORS_WILDCARD`)
 * and the same proportional stage-width formula, so behavior is consistent
 * regardless of which code path is taken.
 */
const COLUMN_POSITIONS_STAGE_MAP: Record<number, number[]> = {};
const COLUMN_POSITIONS_NOTE_MAP: Record<number, number[]> = {};

for (let k = 1; k <= 18; k++) {
  COLUMN_POSITIONS_STAGE_MAP[k] = generateStagePositions(k);
  COLUMN_POSITIONS_NOTE_MAP[k] = generateNotePositions(k);
}

// ============================================
// Public API - Get config by key count
// ============================================

/**
 * Get column colors for a specific key count.
 * Pre-defined palettes for 1-18K; slices the 20-color wildcard palette for > 18K.
 */
export function getColumnColors(keyCount: number): string[] {
  return COLUMN_COLORS_MAP[keyCount] || COLUMN_COLORS_WILDCARD.slice(0, keyCount);
}

/**
 * Get stage positions (column centers) for a specific key count.
 * Pre-computed for 1-18K; computed on demand for > 18K.
 */
export function getColumnPositionsStage(keyCount: number): number[] {
  return keyCount <= 18
    ? COLUMN_POSITIONS_STAGE_MAP[keyCount]
    : generateStagePositions(keyCount);
}

/**
 * Get note positions for a specific key count.
 * Pre-computed for 1-18K; computed on demand for > 18K.
 */
export function getColumnPositionsNote(keyCount: number): number[] {
  return keyCount <= 18
    ? COLUMN_POSITIONS_NOTE_MAP[keyCount]
    : generateNotePositions(keyCount);
}

/**
 * Get stage width for a specific key count.
 * For key counts > 4, expand stage proportionally.
 */
export function getStageWidth(keyCount: number): number {
  return computeStageWidth(keyCount);
}

/**
 * Get column width for a specific key count
 */
export function getColumnWidth(keyCount: number): number {
  return getStageWidth(keyCount) / keyCount;
}

// ============================================
// Default Config (Dynamic - based on currentKeyCount)
// ============================================

// Current key count (can be changed dynamically)
let _keyCount = 4;

// Note: use getter functions (getKeyCount, config, etc.) instead of mutable exports

export function setKeyCount(count: number) {
  _keyCount = Math.max(1, count);
}

export function getKeyCount(): number {
  return _keyCount;
}

// Dynamic config object - alternative access method
export const config = {
  get keyCount() { return _keyCount; },
  get stageWidth() { return getStageWidth(_keyCount); },
  get columnWidth() { return getColumnWidth(_keyCount); },
  get columnPositionsStage() { return getColumnPositionsStage(_keyCount); },
  get columnPositionsNote() { return getColumnPositionsNote(_keyCount); },
  get columnColors() { return getColumnColors(_keyCount); },
};

// ============================================
// Hitsound Configuration (osu! standard)
// ============================================

/**
 * Hitsounds configuration for ManiaStageLayer component.
 */
export interface HitsoundsConfig {
  enabled: boolean;
  trigger: "auto" | "manual";
  volume: number;
}

/**
 * Hitsound configuration following osu! standard values.
 * These values define how hit sounds are played when notes are hit.
 */
export const hitsoundConfig = {
  // Base path for hitsound files - auto-detect environment
  basePath: process.env.NODE_ENV === "production" ? "/osu-map-render/" : "/",

  // Default volume (0-100, osu! standard)
  defaultVolume: 100,

  // Sample Set mapping (osu! standard)
  sampleSets: {
    0: "inherit" as const,  // Inherit from TimingPoint
    1: "normal" as const,   // Normal set
    2: "soft" as const,     // Soft set
    3: "drum" as const,     // Drum set
  } as const,

  // hitSound bit flags (osu! standard)
  hitSoundFlags: {
    normal: 0b0001,  // Bit 0
    whistle: 0b0010, // Bit 1
    finish: 0b0100,  // Bit 2
    clap: 0b1000,    // Bit 3
  },

  // Sound file template
  soundFileTemplate: (sampleSet: string, soundType: string, index?: number) => {
    if (index && index > 1) {
      return `${sampleSet}-hit${soundType}${index}.wav`;
    }
    return `${sampleSet}-hit${soundType}.wav`;
  },

  // Fallback sound files (used when custom files are missing)
  fallbackSounds: {
    normal: "soft-hitnormal.wav",
    whistle: "soft-hitwhistle.wav",
    finish: "soft-hitfinish.wav",
    clap: "soft-hitclap.wav", // Will be silently skipped if missing
  },

  // Concurrency limit (0 = unlimited)
  maxConcurrentSounds: 0,
} as const;

/**
 * Maximum number of hitsound `<Audio>` elements that can be mounted simultaneously.
 * Controls how many concurrent WebMediaPlayers Chromium creates.
 */
export const MAX_HITSOUNDS_CONCURRENT = 20;

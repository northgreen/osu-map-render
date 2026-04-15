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
export const STAGE_HEIGHT = 1080;
export const JUDGMENT_LINE_Y = 900;

// Hit effect duration (in milliseconds)
export const HIT_EFFECT_DURATION = 30;

// LN body opacity
export const LN_BODY_OPACITY = 0.4;

// ============================================
// Key Count Configuration (1K - 18K + Wildcard)
// ============================================

// Color palettes for each key count
const COLUMN_COLORS_MAP: Record<number, string[]> = {
  1: ["#FF6B6B"],
  2: ["#FF6B6B", "#4ECDC4"],
  3: ["#FF6B6B", "#4ECDC4", "#FFD93D"],
  4: ["#FF6B6B", "#4ECDC4", "#4ECDC4", "#FF6B6B"],
  5: ["#FF6B6B", "#FF8E53", "#4ECDC4", "#FF8E53", "#FF6B6B"],
  6: ["#FF6B6B", "#FF8E53", "#4ECDC4", "#4ECDC4", "#FF8E53", "#FF6B6B"],
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

// Stage positions for each key count (center of each column)
function generateStagePositions(keyCount: number): number[] {
  const columnWidth = STAGE_WIDTH_BASE / keyCount;
  return Array.from({ length: keyCount }, (_, i) => STAGE_X + columnWidth * (i + 0.5));
}

// Note positions (shifted from stage positions)
function generateNotePositions(keyCount: number): number[] {
  const columnWidth = STAGE_WIDTH_BASE / keyCount;
  // Shift by -NOTE_WIDTH/2 + columnWidth/2 to center note in column
  return Array.from(
    { length: keyCount },
    (_, i) => STAGE_X + columnWidth * (i + 0.5) - NOTE_WIDTH / 2 + columnWidth / 2 + 56
  );
}

// Pre-computed stage positions (1K - 18K)
const COLUMN_POSITIONS_STAGE_MAP: Record<number, number[]> = {
  1: generateStagePositions(1),
  2: generateStagePositions(2),
  3: generateStagePositions(3),
  4: generateStagePositions(4),
  5: generateStagePositions(5),
  6: generateStagePositions(6),
  7: generateStagePositions(7),
  8: generateStagePositions(8),
  9: generateStagePositions(9),
  10: generateStagePositions(10),
  11: generateStagePositions(11),
  12: generateStagePositions(12),
  13: generateStagePositions(13),
  14: generateStagePositions(14),
  15: generateStagePositions(15),
  16: generateStagePositions(16),
  17: generateStagePositions(17),
  18: generateStagePositions(18),
};

// Pre-computed note positions (1K - 18K)
const COLUMN_POSITIONS_NOTE_MAP: Record<number, number[]> = {
  1: generateNotePositions(1),
  2: generateNotePositions(2),
  3: generateNotePositions(3),
  4: generateNotePositions(4),
  5: generateNotePositions(5),
  6: generateNotePositions(6),
  7: generateNotePositions(7),
  8: generateNotePositions(8),
  9: generateNotePositions(9),
  10: generateNotePositions(10),
  11: generateNotePositions(11),
  12: generateNotePositions(12),
  13: generateNotePositions(13),
  14: generateNotePositions(14),
  15: generateNotePositions(15),
  16: generateNotePositions(16),
  17: generateNotePositions(17),
  18: generateNotePositions(18),
};

// Wildcard fallback positions for key counts > 18
function generateWildcardPositions(keyCount: number, offset: number): number[] {
  const columnWidth = STAGE_WIDTH_BASE / keyCount;
  return Array.from(
    { length: keyCount },
    (_, i) => offset + columnWidth * (i + 0.5)
  );
}

// ============================================
// Public API - Get config by key count
// ============================================

/**
 * Get column colors for a specific key count
 */
export function getColumnColors(keyCount: number): string[] {
  return COLUMN_COLORS_MAP[keyCount] || COLUMN_COLORS_WILDCARD.slice(0, keyCount);
}

/**
 * Get stage positions (column centers) for a specific key count
 */
export function getColumnPositionsStage(keyCount: number): number[] {
  if (keyCount <= 18) {
    return COLUMN_POSITIONS_STAGE_MAP[keyCount];
  }
  return generateWildcardPositions(keyCount, STAGE_X);
}

/**
 * Get note positions for a specific key count
 */
export function getColumnPositionsNote(keyCount: number): number[] {
  if (keyCount <= 18) {
    return COLUMN_POSITIONS_NOTE_MAP[keyCount];
  }
  return generateWildcardPositions(keyCount, STAGE_X + 56);
}

/**
 * Get stage width for a specific key count
 * For key counts > 4, expand stage proportionally
 */
export function getStageWidth(keyCount: number): number {
  if (keyCount <= 4) {
    return STAGE_WIDTH_BASE;
  }
  // For key counts > 4, expand stage width proportionally
  return STAGE_WIDTH_BASE + (keyCount - 4) * (STAGE_WIDTH_BASE / 4);
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

// Mutable exports - will be updated when setKeyCount is called
export let KEY_COUNT = 4;
export const STAGE_WIDTH = STAGE_WIDTH_BASE;
export let COLUMN_WIDTH = STAGE_WIDTH_BASE / 4;
export let COLUMN_POSITIONS_STAGE = COLUMN_POSITIONS_STAGE_MAP[4];
export let COLUMN_POSITIONS_NOTE = COLUMN_POSITIONS_NOTE_MAP[4];
export let COLUMN_COLORS = COLUMN_COLORS_MAP[4];

export function setKeyCount(count: number) {
  _keyCount = Math.max(1, count);
  KEY_COUNT = _keyCount;
  COLUMN_WIDTH = getColumnWidth(_keyCount);
  COLUMN_POSITIONS_STAGE = getColumnPositionsStage(_keyCount);
  COLUMN_POSITIONS_NOTE = getColumnPositionsNote(_keyCount);
  COLUMN_COLORS = getColumnColors(_keyCount);
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

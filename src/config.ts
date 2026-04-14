// osu!mania renderer configuration
// Modify these values to adjust the rendering

// Scroll speed - determines how fast notes fall
// Common values: 10 (slow), 15, 20 (default), 25, 30, 40 (fast)
export const SCROLL_SPEED = 27;

// Base visible time at scroll speed 10 (in milliseconds)
export const BASE_VISIBLE_TIME = 1800;

// Note dimensions
export const NOTE_WIDTH = 100;
export const NOTE_HEIGHT = 40;

// Stage dimensions (for rendering background)
export const STAGE_X = 64;
export const STAGE_WIDTH = 512;
export const STAGE_HEIGHT = 1080;
export const COLUMN_WIDTH = 128;
export const COLUMN_POSITIONS_STAGE = [64, 192, 320, 448];
export const COLUMN_POSITIONS_NOTE = [120, 257, 385, 513];
export const JUDGMENT_LINE_Y = 900;

// Column colors
export const COLUMN_COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4"];

// Hit effect duration (in milliseconds)
export const HIT_EFFECT_DURATION = 300;

// LN body opacity
export const LN_BODY_OPACITY = 0.4;

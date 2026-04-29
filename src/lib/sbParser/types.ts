// ============================================
// Storyboard Types & Constants
// Zero Node.js dependencies — safe for browser bundling.
// ============================================

// "Infinite" duration sentinel (24 hours in ms)
export const INFINITE_DURATION = 24 * 60 * 60 * 1000; // 86400000ms

export type Layer = "Background" | "Fail" | "Pass" | "Foreground" | "Overlay";
export type Origin =
  | "TopLeft" | "Centre" | "CentreLeft" | "TopRight"
  | "BottomCentre" | "TopCentre" | "CentreRight"
  | "BottomLeft" | "BottomRight";

export type CommandType = "F" | "M" | "MX" | "MY" | "S" | "V" | "R" | "C" | "P";

// Easing function mapping (0-34)
export const EASING_NAMES: Record<number, string> = {
  0: "linear",
  1: "easeOut",
  2: "easeIn",
  3: "easeInQuad",
  4: "easeOutQuad",
  5: "easeInOutQuad",
  6: "easeInCubic",
  7: "easeOutCubic",
  8: "easeInOutCubic",
  9: "easeInQuart",
  10: "easeOutQuart",
  11: "easeInOutQuart",
  12: "easeInQuint",
  13: "easeOutQuint",
  14: "easeInOutQuint",
  15: "easeInSine",
  16: "easeOutSine",
  17: "easeInOutSine",
  18: "easeInExpo",
  19: "easeOutExpo",
  20: "easeInOutExpo",
  21: "easeInCirc",
  22: "easeOutCirc",
  23: "easeInOutCirc",
  24: "easeInElastic",
  25: "easeOutElastic",
  26: "easeOutElasticHalf",
  27: "easeOutElasticQuarter",
  28: "easeInOutElastic",
  29: "easeInBack",
  30: "easeOutBack",
  31: "easeInOutBack",
  32: "easeInBounce",
  33: "easeOutBounce",
  34: "easeInOutBounce",
};

export interface SbCommand {
  type: CommandType;
  easing: number;
  startTime: number;
  endTime: number;
  params: number[];
  paramStrings?: string[];
}

export interface SbLoop {
  startTime: number;
  endTime: number;
  repeatCount: number;
  commands: SbCommand[];
  loopDuration: number;
}

export interface SbObject {
  id: string;
  type: "sprite" | "animation" | "video";
  layer: Layer;
  origin: Origin;
  path: string;
  x: number;
  y: number;
  frameCount?: number;
  frameDelay?: number;
  loopType?: "LoopForever" | "LoopOnce";
  commands: SbCommand[];
  loops: SbLoop[];
  // P command parameters
  flipH?: boolean;
  flipV?: boolean;
  additive?: boolean;
}

export interface SbSample {
  id: string;
  time: number;
  layer: Layer;
  path: string;
  volume: number;
}

export interface ParsedStoryboard {
  objects: SbObject[];
  samples: SbSample[];
  variables: Record<string, string>;
  duration: number;
}

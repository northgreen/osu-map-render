import type { SbCommand, SbLoop } from "../sbParser";

/**
 * Shared test helper functions for storyboard command tests.
 *
 * These helpers construct `SbCommand` and `SbLoop` objects matching
 * osu! storyboard command semantics so tests can focus on behavior
 * rather than boilerplate object literals.
 *
 * ## osu! Command Reference
 *
 * | Type | Description                                  | Params                       |
 * |------|----------------------------------------------|------------------------------|
 * | M    | Move (position)                              | [x1, y1, x2, y2]            |
 * | MX   | Move X only                                  | [x1, x2]                    |
 * | MY   | Move Y only                                  | [y1, y2]                    |
 * | S    | Scale                                        | [startScale, endScale]      |
 * | V    | Vector scale (independent X/Y)               | [sx1, sy1, sx2, sy2]        |
 * | F    | Fade (opacity)                               | [startOpacity, endOpacity]  |
 * | R    | Rotate (radians)                             | [startRad, endRad]          |
 * | C    | Color (RGB)                                  | [r1, g1, b1, r2, g2, b2]   |
 *
 * All commands support an `easing` parameter (0 = linear, 1 = easeOut,
 * 2 = easeIn, etc., up to 34).
 */

/**
 * Create a move command (M, MX, or MY).
 *
 * osu! move commands interpolate position over time. `M` animates both
 * axes, `MX` animates X only, and `MY` animates Y only.
 *
 * @param type - Command type: `"M"` for both axes, `"MX"` for X only, `"MY"` for Y only
 * @param startTime - Time in milliseconds when the command begins
 * @param endTime - Time in milliseconds when the command ends
 * @param params - Position parameters: `[x1, y1, x2, y2]` for M; `[x1, x2]` for MX; `[y1, y2]` for MY
 * @param easing - Easing function index (0 = linear, default)
 *
 * @example
 * ```ts
 * // M: move from (0,0) to (100,100)
 * createMCommand("M", 0, 1000, [0, 0, 100, 100])
 *
 * // MX: animate X from 0 to 200, Y stays at default
 * createMCommand("MX", 0, 1000, [0, 200])
 * ```
 */
export function createMCommand(
  type: "M" | "MX" | "MY",
  startTime: number,
  endTime: number,
  params: number[],
  easing = 0,
): SbCommand {
  return { type, easing, startTime, endTime, params };
}

/**
 * Create a scale command (S).
 *
 * osu! scale commands interpolate a uniform scale multiplier over time.
 * A scale of 1 means original size; 2 means double size.
 *
 * @param startTime - Time in milliseconds when the command begins
 * @param endTime - Time in milliseconds when the command ends
 * @param startScale - Scale factor at the start of the command
 * @param endScale - Scale factor at the end of the command
 * @param easing - Easing function index (0 = linear, default)
 *
 * @example
 * ```ts
 * // Scale from 1x to 3x over 500ms
 * createSCommand(0, 500, 1, 3)
 *
 * // Static scale of 2x
 * createSCommand(0, 1000, 2, 2)
 * ```
 */
export function createSCommand(
  startTime: number,
  endTime: number,
  startScale: number,
  endScale: number,
  easing = 0,
): SbCommand {
  return { type: "S", easing, startTime, endTime, params: [startScale, endScale] };
}

/**
 * Create a vector scale command (V).
 *
 * osu! vector scale commands set independent X and Y scale factors,
 * allowing non-uniform stretching. Unlike S commands (relative multiplier),
 * V commands set absolute dimensions in storyboard units.
 *
 * @param startTime - Time in milliseconds when the command begins
 * @param endTime - Time in milliseconds when the command ends
 * @param sx1 - X scale factor at the start
 * @param sy1 - Y scale factor at the start
 * @param sx2 - X scale factor at the end
 * @param sy2 - Y scale factor at the end
 * @param easing - Easing function index (0 = linear, default)
 *
 * @example
 * ```ts
 * // Stretch horizontally from 1x to 3x, Y stays at 1x
 * createVCommand(0, 1000, 1, 1, 3, 1)
 * ```
 */
export function createVCommand(
  startTime: number,
  endTime: number,
  sx1: number,
  sy1: number,
  sx2: number,
  sy2: number,
  easing = 0,
): SbCommand {
  return { type: "V", easing, startTime, endTime, params: [sx1, sy1, sx2, sy2] };
}

/**
 * Create a fade command (F).
 *
 * osu! fade commands interpolate opacity over time. Values range from
 * 0 (fully transparent) to 1 (fully opaque).
 *
 * @param startTime - Time in milliseconds when the command begins
 * @param endTime - Time in milliseconds when the command ends
 * @param startOpacity - Opacity at the start (0 = transparent, 1 = opaque)
 * @param endOpacity - Opacity at the end (0 = transparent, 1 = opaque)
 * @param easing - Easing function index (0 = linear, default)
 *
 * @example
 * ```ts
 * // Fade in from transparent to opaque over 500ms
 * createFCommand(0, 500, 0, 1)
 *
 * // Fade out from opaque to transparent
 * createFCommand(0, 500, 1, 0)
 * ```
 */
export function createFCommand(
  startTime: number,
  endTime: number,
  startOpacity: number,
  endOpacity: number,
  easing = 0,
): SbCommand {
  return { type: "F", easing, startTime, endTime, params: [startOpacity, endOpacity] };
}

/**
 * Create an R (Rotate) command.
 *
 * osu! rotate commands interpolate rotation in degrees over time.
 * Positive values rotate clockwise.
 *
 * @param startTime - Time in milliseconds when the command begins
 * @param endTime - Time in milliseconds when the command ends
 * @param startDeg - Rotation in degrees at the start
 * @param endDeg - Rotation in degrees at the end
 * @param easing - Easing function index (0 = linear, default)
 *
 * @example
 * ```ts
 * // Rotate 90 degrees clockwise
 * createRCommand(0, 1000, 0, 90)
 *
 * // Full rotation (360 degrees)
 * createRCommand(0, 2000, 0, 360)
 * ```
 */
export function createRCommand(
  startTime: number,
  endTime: number,
  startDeg: number,
  endDeg: number,
  easing = 0,
): SbCommand {
  return { type: "R", easing, startTime, endTime, params: [startDeg, endDeg] };
}

/**
 * Create a color command (C).
 *
 * osu! color commands interpolate RGB color values over time.
 * Channel values range from 0 to 255 and are normalized to [0, 1]
 * by the evaluator (divided by 255).
 *
 * @param startTime - Time in milliseconds when the command begins
 * @param endTime - Time in milliseconds when the command ends
 * @param r1 - Red channel at the start (0-255)
 * @param g1 - Green channel at the start (0-255)
 * @param b1 - Blue channel at the start (0-255)
 * @param r2 - Red channel at the end (0-255)
 * @param g2 - Green channel at the end (0-255)
 * @param b2 - Blue channel at the end (0-255)
 * @param easing - Easing function index (0 = linear, default)
 *
 * @example
 * ```ts
 * // Transition from red to green
 * createCCommand(0, 1000, 255, 0, 0, 0, 255, 0)
 *
 * // Static white
 * createCCommand(0, 1000, 255, 255, 255, 255, 255, 255)
 * ```
 */
export function createCCommand(
  startTime: number,
  endTime: number,
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
  easing = 0,
): SbCommand {
  return {
    type: "C",
    easing,
    startTime,
    endTime,
    params: [r1, g1, b1, r2, g2, b2],
  };
}

/**
 * Create a loop containing commands.
 *
 * osu! loops repeat their nested commands for a specified number of
 * iterations. The `loopDuration` determines how long one iteration lasts
 * and is typically calculated as `maxCmdEnd - minCmdStart` from the
 * nested commands.
 *
 * In osu!, `repeatCount` represents the number of **additional** plays
 * beyond the first. So `repeatCount=0` means 1 total play, `repeatCount=1`
 * means 2 total plays, etc.
 *
 * @param startTime - Time in milliseconds when the loop begins
 * @param repeatCount - Number of additional iterations (0 = 1 total play)
 * @param commands - Array of commands to repeat within each iteration
 * @param loopDuration - Duration of one iteration in milliseconds
 *
 * @example
 * ```ts
 * // Loop starting at t=0, repeating 3 times (4 total plays)
 * createLoop(0, 3, [
 *   createFCommand(0, 500, 0, 1),
 * ], 500)
 *
 * // Common osu! pattern: flash effect looping while note is held
 * createLoop(60000, 30, [
 *   createFCommand(0, 337, 0, 1),
 *   createFCommand(337, 674, 1, 0),
 * ], 674)
 * ```
 */
export function createLoop(
  startTime: number,
  repeatCount: number,
  commands: SbCommand[],
  loopDuration: number,
): SbLoop {
  return { startTime, repeatCount, commands, loopDuration };
}

/**
 * Empty loops array for tests that don't use loops.
 *
 * Use this constant instead of creating `[]` inline to make tests
 * more readable and consistent.
 *
 * @example
 * ```ts
 * const pos = getPosition(commands, noLoops, 500, 320, 240);
 * ```
 */
export const noLoops: SbLoop[] = [];

import { SbLoop, INFINITE_DURATION } from "../sbParser/types";
import { applyEasing } from "./easing";

// Get command value within loops - handles iteration timing
// Each iteration continues from where the previous one ended (continuous animation)
export function getLoopCommandValue(
  loops: SbLoop[],
  cmdType: string,
  currentTime: number,
  paramIndex: number,
): number | null {
  let preReadValue: number | null = null;

  for (const loop of loops) {
    if (currentTime < loop.startTime) continue;

    const minCmdStart = Math.min(...loop.commands.map((c) => c.startTime));
    const maxCmdEnd = Math.max(
      ...loop.commands.map((c) =>
        c.endTime === INFINITE_DURATION ? c.startTime : c.endTime,
      ),
    );
    const loopDuration = maxCmdEnd - minCmdStart;

    if (loopDuration <= 0) continue;

    // Compute iteration relative to when the first command iteration actually starts
    const firstCmdAbs = loop.startTime + minCmdStart;
    const timeSinceFirstCmd = currentTime - firstCmdAbs;

    // osu! behavior: ApplyInitialValue sets StartValue immediately when loop starts
    // (StoryboardSprite.cs:149, StoryboardLoopingGroup.cs:54)
    // When loop has started but first command hasn't, return the command's start value
    if (timeSinceFirstCmd < 0) {
      for (const cmd of loop.commands) {
        if (cmd.type !== cmdType) continue;
        const value = cmd.params[paramIndex];
        if (
          value !== undefined &&
          (preReadValue === null || cmd.startTime < minCmdStart)
        ) {
          preReadValue = value;
        }
      }
      continue;
    }

    const iteration = Math.floor(timeSinceFirstCmd / loopDuration);

    if (loop.repeatCount > 0 && iteration > loop.repeatCount) {
      // After loop ends, use the end value of the last matching command
      let lastEndValue: number | null = null;
      for (const cmd of loop.commands) {
        if (cmd.type !== cmdType) continue;
        const endIndex =
          cmdType === "C"
            ? paramIndex + 3 // C commands: [r1, g1, b1, r2, g2, b2]
            : cmdType === "M" || cmdType === "V"
              ? paramIndex + 2
              : paramIndex + 1; // MX, MY, F, S, R 等
        lastEndValue = cmd.params[endIndex] ?? cmd.params[paramIndex] ?? null;
      }
      if (lastEndValue !== null) preReadValue = lastEndValue;
      continue;
    }

    const iterationStart = firstCmdAbs + iteration * loopDuration;

    for (const cmd of loop.commands) {
      if (cmd.type !== cmdType) continue;

      const cmdEffectiveEnd =
        cmd.endTime === INFINITE_DURATION ? cmd.startTime : cmd.endTime;

      const cmdStartAbs = iterationStart + (cmd.startTime - minCmdStart);
      const cmdEndAbs = iterationStart + (cmdEffectiveEnd - minCmdStart);

      if (currentTime >= cmdStartAbs && currentTime <= cmdEndAbs) {
        const cmdDuration = cmdEndAbs - cmdStartAbs;
        if (cmdDuration <= 0) {
          // Instant command: return the start value (osu! ApplyInitialValue behavior)
          // Position persists after the instant change
          return cmd.params[paramIndex];
        }

        const relTimeInCmd = currentTime - cmdStartAbs;
        const t = relTimeInCmd / cmdDuration;

        const endIndex =
          cmdType === "C"
            ? paramIndex + 3 // C commands: [r1, g1, b1, r2, g2, b2]
            : cmdType === "M" || cmdType === "V"
              ? paramIndex + 2
              : paramIndex + 1; // MX, MY, F, S, R 等
        const iterStartValue = cmd.params[paramIndex];
        const iterEndValue = cmd.params[endIndex] ?? iterStartValue;

        const easedT = applyEasing(t, cmd.easing);
        return iterStartValue + (iterEndValue - iterStartValue) * easedT;
      } else if (currentTime > cmdEndAbs && cmdEndAbs - cmdStartAbs === 0) {
        // Instant command has ended - position persists (osu! behavior)
        preReadValue = cmd.params[paramIndex];
      }
    }
  }

  return preReadValue;
}

// Get loop opacity - handles both active loops and loops that have finished
export function getLoopOpacity(loops: SbLoop[], currentTime: number): number | null {
  let lastLoopOpacity: number | null = null;

  for (const loop of loops) {
    if (currentTime < loop.startTime) continue;

    const fCommands = loop.commands.filter((c) => c.type === "F");
    if (fCommands.length === 0) continue;

    const minCmdStart = Math.min(...loop.commands.map((c) => c.startTime));
    const maxCmdEnd = Math.max(
      ...loop.commands.map((c) =>
        c.endTime === INFINITE_DURATION ? c.startTime : c.endTime,
      ),
    );

    const loopDuration = maxCmdEnd - minCmdStart;

    if (loopDuration <= 0) continue;

    // Compute iteration relative to when the first command iteration actually starts
    const firstCmdAbs = loop.startTime + minCmdStart;
    const timeSinceFirstCmd = currentTime - firstCmdAbs;
    if (timeSinceFirstCmd < 0) continue;

    const iteration = Math.floor(timeSinceFirstCmd / loopDuration);

    if (loop.repeatCount > 0 && iteration > loop.repeatCount) continue;

    const iterationStart = firstCmdAbs + iteration * loopDuration;

    for (const cmd of fCommands) {
      const cmdEffectiveEnd =
        cmd.endTime === INFINITE_DURATION ? cmd.startTime : cmd.endTime;

      const cmdStartAbs = iterationStart + (cmd.startTime - minCmdStart);
      const cmdEndAbs = iterationStart + (cmdEffectiveEnd - minCmdStart);

      if (currentTime >= cmdStartAbs && currentTime <= cmdEndAbs) {
        const duration = cmdEndAbs - cmdStartAbs;
        if (duration <= 0) continue;

        const relTimeInCmd = currentTime - cmdStartAbs;
        const t = relTimeInCmd / duration;
        const iterStartValue = cmd.params[0];
        const iterEndValue = cmd.params[1] ?? iterStartValue;
        lastLoopOpacity =
          iterStartValue +
          (iterEndValue - iterStartValue) * applyEasing(t, cmd.easing);
      }
    }
  }

  return lastLoopOpacity;
}

interface FlipState {
  flipH: boolean;
  flipV: boolean;
  additive: boolean;
}

export function getLoopFlipState(
  loops: SbLoop[],
  currentTime: number,
): FlipState | null {
  let result: FlipState | null = null;

  for (const loop of loops) {
    if (currentTime < loop.startTime) continue;

    const pCommands = loop.commands.filter(
      (c) => c.type === "P" && c.paramStrings && c.paramStrings.length > 0,
    );
    if (pCommands.length === 0) continue;

    const minCmdStart = Math.min(...loop.commands.map((c) => c.startTime));
    const maxCmdEnd = Math.max(
      ...loop.commands.map((c) =>
        c.endTime === INFINITE_DURATION ? c.startTime : c.endTime,
      ),
    );

    const loopDuration = maxCmdEnd - minCmdStart;
    if (loopDuration <= 0) continue;

    const firstCmdAbs = loop.startTime + minCmdStart;
    const timeSinceFirstCmd = currentTime - firstCmdAbs;
    if (timeSinceFirstCmd < 0) continue;

    const iteration = Math.floor(timeSinceFirstCmd / loopDuration);
    if (loop.repeatCount > 0 && iteration > loop.repeatCount) continue;

    const iterationStart = firstCmdAbs + iteration * loopDuration;

    for (const cmd of pCommands) {
      const param = cmd.paramStrings![0];
      const cmdEffectiveEnd =
        cmd.endTime === INFINITE_DURATION ? cmd.startTime : cmd.endTime;

      const cmdStartAbs = iterationStart + (cmd.startTime - minCmdStart);
      const cmdEndAbs = iterationStart + (cmdEffectiveEnd - minCmdStart);

      if (currentTime >= cmdStartAbs && currentTime <= cmdEndAbs) {
        if (!result) result = { flipH: false, flipV: false, additive: false };
        if (param === "H") result.flipH = true;
        else if (param === "V") result.flipV = true;
        else if (param === "A") result.additive = true;
      }
    }
  }

  return result;
}

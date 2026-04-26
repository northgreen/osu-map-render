import { SbLoop } from "../sbParser";
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
        c.endTime === Number.MAX_SAFE_INTEGER ? c.startTime : c.endTime,
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
          cmdType === "M" ||
          cmdType === "MX" ||
          cmdType === "MY" ||
          cmdType === "V"
            ? paramIndex + 2
            : cmdType === "C"
              ? paramIndex + 3 // C commands: [r1, g1, b1, r2, g2, b2]
              : paramIndex + 1;
        lastEndValue = cmd.params[endIndex] ?? cmd.params[paramIndex] ?? null;
      }
      if (lastEndValue !== null) preReadValue = lastEndValue;
      continue;
    }

    const iterationStart = firstCmdAbs + iteration * loopDuration;

    for (const cmd of loop.commands) {
      if (cmd.type !== cmdType) continue;

      const cmdEffectiveEnd =
        cmd.endTime === Number.MAX_SAFE_INTEGER ? cmd.startTime : cmd.endTime;
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
          cmdType === "M" ||
          cmdType === "MX" ||
          cmdType === "MY" ||
          cmdType === "V"
            ? paramIndex + 2
            : cmdType === "C"
              ? paramIndex + 3 // C commands: [r1, g1, b1, r2, g2, b2]
              : paramIndex + 1;
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
        c.endTime === Number.MAX_SAFE_INTEGER ? c.startTime : c.endTime,
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
        cmd.endTime === Number.MAX_SAFE_INTEGER ? cmd.startTime : cmd.endTime;
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

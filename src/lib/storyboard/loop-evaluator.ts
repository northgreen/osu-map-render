import { SbLoop, INFINITE_DURATION } from "../sbParser/types";
import { applyEasing } from "./easing";

// Get command value within loops - returns value with timing info
// Uses "latest startTime wins" rule matching osu! behavior:
// all commands (direct + loop iterations) are sorted by startTime,
// and the one with the latest startTime at any given time determines the value.
export function getLoopCommandValue(
  loops: SbLoop[],
  cmdType: string,
  currentTime: number,
  paramIndex: number,
): { value: number; startTime: number; endTime: number } | null {
  let latest: { value: number; startTime: number; endTime: number } | null = null;

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

    const firstCmdAbs = loop.startTime + minCmdStart;
    const timeSinceFirstCmd = currentTime - firstCmdAbs;

    // Pre-read: loop has started but first command hasn't
    if (timeSinceFirstCmd < 0) {
      for (const cmd of loop.commands) {
        if (cmd.type !== cmdType) continue;
        const value = cmd.params[paramIndex];
        if (value !== undefined) {
          // Only set if no later result found (pre-read is earliest possible time)
          if (!latest) {
            latest = {
              value,
              startTime: firstCmdAbs,
              endTime:
                firstCmdAbs +
                (cmd.endTime === INFINITE_DURATION
                  ? 0
                  : cmd.endTime - cmd.startTime),
            };
          }
        }
      }
      continue;
    }

    const iteration = Math.floor(timeSinceFirstCmd / loopDuration);

    if (loop.repeatCount > 0 && iteration > loop.repeatCount) {
      // After loop ends, use the end value of the last matching command
      // The endValue persists with the last command's absolute endTime
      for (const cmd of loop.commands) {
        if (cmd.type !== cmdType) continue;
        const endIndex =
          cmdType === "C"
            ? paramIndex + 3
            : cmdType === "M" || cmdType === "V"
              ? paramIndex + 2
              : paramIndex + 1;
        const value = cmd.params[endIndex] ?? cmd.params[paramIndex];
        if (value !== undefined) {
          const cmdEffectiveEnd =
            cmd.endTime === INFINITE_DURATION ? cmd.startTime : cmd.endTime;
          const cmdStartAbs =
            firstCmdAbs +
            loop.repeatCount * loopDuration +
            (cmd.startTime - minCmdStart);
          const cmdEndAbs =
            firstCmdAbs +
            loop.repeatCount * loopDuration +
            (cmdEffectiveEnd - minCmdStart);
          if (!latest || cmdStartAbs > latest.startTime) {
            latest = { value, startTime: cmdStartAbs, endTime: cmdEndAbs };
          }
        }
      }
      continue;
    }

    const iterationStart = firstCmdAbs + iteration * loopDuration;

    for (const cmd of loop.commands) {
      if (cmd.type !== cmdType) continue;

      const cmdEffectiveEnd =
        cmd.endTime === INFINITE_DURATION ? cmd.startTime : cmd.endTime;
      const cmdStartAbs = iterationStart + (cmd.startTime - minCmdStart);
      const cmdEndAbs = iterationStart + (cmdEffectiveEnd - minCmdStart);

      if (currentTime >= cmdStartAbs) {
        // Command has started (active or ended)
        let value: number;
        if (currentTime <= cmdEndAbs) {
          // Active: interpolate
          const cmdDuration = cmdEndAbs - cmdStartAbs;
          if (cmdDuration <= 0) {
            value = cmd.params[paramIndex];
          } else {
            const relTimeInCmd = currentTime - cmdStartAbs;
            const t = relTimeInCmd / cmdDuration;
            const endIndex =
              cmdType === "C"
                ? paramIndex + 3
                : cmdType === "M" || cmdType === "V"
                  ? paramIndex + 2
                  : paramIndex + 1;
            const iterStartValue = cmd.params[paramIndex];
            const iterEndValue = cmd.params[endIndex] ?? iterStartValue;
            const easedT = applyEasing(t, cmd.easing);
            value =
              iterStartValue +
              (iterEndValue - iterStartValue) * easedT;
          }
        } else {
          // Ended: use end value (persists)
          const endIndex =
            cmdType === "C"
              ? paramIndex + 3
              : cmdType === "M" || cmdType === "V"
                ? paramIndex + 2
                : paramIndex + 1;
          value = cmd.params[endIndex] ?? cmd.params[paramIndex];
        }

        if (!latest || cmdStartAbs > latest.startTime) {
          latest = { value, startTime: cmdStartAbs, endTime: cmdEndAbs };
        }
      }
    }
  }

  return latest;
}

// Get loop opacity - returns value with timing info
// Uses "latest startTime wins" rule matching osu! behavior
export function getLoopOpacity(
  loops: SbLoop[],
  currentTime: number,
): { value: number; startTime: number; endTime: number } | null {
  let latest: {
    value: number;
    startTime: number;
    endTime: number;
  } | null = null;

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

      if (currentTime >= cmdStartAbs) {
        let value: number;
        if (currentTime <= cmdEndAbs) {
          const duration = cmdEndAbs - cmdStartAbs;
          if (duration <= 0) continue;
          const relTimeInCmd = currentTime - cmdStartAbs;
          const t = relTimeInCmd / duration;
          const iterStartValue = cmd.params[0];
          const iterEndValue = cmd.params[1] ?? iterStartValue;
          value =
            iterStartValue +
            (iterEndValue - iterStartValue) * applyEasing(t, cmd.easing);
        } else {
          value = cmd.params[1] ?? cmd.params[0];
        }

        if (!latest || cmdStartAbs > latest.startTime) {
          latest = {
            value,
            startTime: cmdStartAbs,
            endTime: cmdEndAbs,
          };
        }
      }
    }
  }

  return latest;
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

import { SbCommand, SbLoop } from "../sbParser";

export function isObjectVisible(
  commands: SbCommand[],
  loops: SbLoop[],
  currentTime: number,
): boolean {
  if (commands.length === 0 && loops.length === 0) return false;

  // Find the time range of all commands
  let latestEndTime = -Infinity;
  let earliestStartTime = Infinity;

  // Regular commands
  for (const cmd of commands) {
    if (cmd.startTime < earliestStartTime) earliestStartTime = cmd.startTime;
    if (cmd.endTime > latestEndTime) {
      latestEndTime = cmd.endTime;
    }
  }

  // Loop commands
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

    // Total visible range: firstCmdAbs to last iteration end
    // Sprite is only visible when the first command iteration starts, not from loop.startTime
    const totalIterations = loop.repeatCount + 1;
    const loopWindowEnd = firstCmdAbs + totalIterations * loopDuration;

    if (firstCmdAbs < earliestStartTime) {
      earliestStartTime = firstCmdAbs;
    }
    if (loopWindowEnd > latestEndTime) {
      latestEndTime = loopWindowEnd;
    }

    if (timeSinceFirstCmd < 0) continue;

    const iteration = Math.floor(timeSinceFirstCmd / loopDuration);

    if (loop.repeatCount > 0 && iteration > loop.repeatCount) continue;
  }

  // Object is not visible before first command starts
  if (earliestStartTime < 0 && currentTime < 0) return false;
  if (earliestStartTime >= 0 && currentTime < earliestStartTime) return false;

  // Object is not visible after last command ends
  if (latestEndTime !== Number.MAX_SAFE_INTEGER && currentTime > latestEndTime)
    return false;

  return true;
}

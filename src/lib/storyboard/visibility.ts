import { SbCommand, SbLoop, INFINITE_DURATION } from "../sbParser/types";
import { getOpacity } from "./command-evaluator";

/**
 * Check if a storyboard object is visible at the given time.
 *
 * Matches osu! behavior:
 * - LifetimeStart: First visible F command start, or earliest command start if no F commands
 * - LifetimeEnd: Latest command end time or loop display end time
 * - Visible when: LifetimeStart <= currentTime <= LifetimeEnd AND alpha > 0
 */
export function isObjectVisible(
  commands: SbCommand[],
  loops: SbLoop[],
  currentTime: number,
): boolean {
  if (commands.length === 0 && loops.length === 0) return false;

  // Calculate LifetimeStart
  let lifetimeStart: number;
  const fadeCommands = commands.filter((cmd) => cmd.type === "F");

  if (fadeCommands.length > 0) {
    // Find first visible F command (StartValue > 0 || EndValue > 0)
    // osu! skips 0→0 noop transforms for lifetime calculation
    const firstVisible = fadeCommands.find(
      (cmd) => (cmd.params[0] ?? 0) > 0 || (cmd.params[1] ?? 0) > 0,
    );
    lifetimeStart = firstVisible
      ? firstVisible.startTime
      : fadeCommands[0].startTime;
  } else {
    // No F commands → use earliest command start time (EarliestTransformTime)
    lifetimeStart = Math.min(...commands.map((c) => c.startTime));
  }

  // Calculate LifetimeEnd (EndTimeForDisplay)
  let lifetimeEnd = Math.max(
    ...commands.map((c) =>
      c.endTime === INFINITE_DURATION ? c.startTime : c.endTime,
    ),
  );

  for (const loop of loops) {
    // osu! EndTimeForDisplay: loop.startTime + loop.loopDuration * (loop.repeatCount + 1)
    const loopEnd =
      loop.startTime + loop.loopDuration * (loop.repeatCount + 1);
    lifetimeEnd = Math.max(lifetimeEnd, loopEnd);
  }

  // Before lifetime start → not visible
  if (currentTime < lifetimeStart) return false;

  // After lifetime end → not visible
  if (currentTime > lifetimeEnd) return false;

  // Within lifetime → check alpha value
  const opacity = getOpacity(commands, loops, currentTime);
  return opacity > 0;
}

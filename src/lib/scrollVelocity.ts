import { TimingPoint } from "./osuParser";

// ============================================
// Constants
// ============================================

/** Floating-point comparison threshold for scroll velocity equality */
const FLOAT_EPSILON = 1e-6;

/** Default beat length in ms when no timing points are available */
const DEFAULT_BEAT_LENGTH = 1000;

/** Base multiplier for scroll velocity calculation from uninherited timing points */
const VELOCITY_MULTIPLIER_BASE = 100;

export interface ScrollVelocitySegment {
  startTime: number;
  scrollVelocity: number;
}

function findMostCommonBeatLength(timingPoints: TimingPoint[]): number {
  const uninherited = timingPoints
    .filter(tp => tp.uninherited && tp.beatLength > 0)
    .sort((a, b) => a.time - b.time);

  if (uninherited.length === 0) return DEFAULT_BEAT_LENGTH;

  const durations: Map<number, number> = new Map();
  for (let i = 0; i < uninherited.length; i++) {
    const startTime = i === 0 ? 0 : uninherited[i].time;
    const lastTime = uninherited[uninherited.length - 1].time;
    const endTime = i === uninherited.length - 1 ? lastTime : uninherited[i + 1].time;
    const duration = endTime - startTime;
    const key = Math.round(uninherited[i].beatLength * 1000) / 1000;
    durations.set(key, (durations.get(key) || 0) + duration);
  }

  let maxDuration = 0;
  let mostCommon = DEFAULT_BEAT_LENGTH;
  for (const [beatLength, duration] of durations) {
    if (duration > maxDuration) {
      maxDuration = duration;
      mostCommon = beatLength;
    }
  }

  const minBL = Math.min(...uninherited.map(tp => tp.beatLength));
  const maxBL = Math.max(...uninherited.map(tp => tp.beatLength));
  return Math.max(minBL, Math.min(maxBL, mostCommon));
}

export function extractScrollVelocitySegments(
  timingPoints: TimingPoint[]
): ScrollVelocitySegment[] {
  const sorted = [...timingPoints].sort((a, b) => a.time - b.time);
  const mostCommon = findMostCommonBeatLength(timingPoints);

  const segments: ScrollVelocitySegment[] = [];
  let currentScrollSpeed = 1;
  let currentTimingBL = mostCommon;

  const initialMultiplier = currentScrollSpeed * mostCommon / currentTimingBL;
  segments.push({ startTime: 0, scrollVelocity: initialMultiplier });

  for (const tp of sorted) {
    if (tp.uninherited && tp.beatLength > 0) {
      currentTimingBL = tp.beatLength;
    } else if (!tp.uninherited && tp.beatLength < 0) {
      currentScrollSpeed = VELOCITY_MULTIPLIER_BASE / Math.abs(tp.beatLength);
    } else {
      continue;
    }

    const multiplier = currentScrollSpeed * mostCommon / currentTimingBL;
    const lastMultiplier = segments[segments.length - 1].scrollVelocity;

    if (Math.abs(multiplier - lastMultiplier) > FLOAT_EPSILON) {
      segments.push({ startTime: tp.time, scrollVelocity: multiplier });
    }
  }

  return segments;
}

export function getScrollVelocityAt(segments: ScrollVelocitySegment[], time: number): number {
  if (segments.length === 0) return 1.0;

  let lo = 0;
  let hi = segments.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (segments[mid].startTime <= time) lo = mid;
    else hi = mid - 1;
  }

  return segments[lo]?.scrollVelocity ?? 1.0;
}

interface PositionMapping {
  time: number;
  position: number;
  sv: number;
}

export class SequentialScrollAlgorithm {
  private positionMappings: PositionMapping[] = [];

  constructor(
    private svSegments: ScrollVelocitySegment[],
    private timeRange: number
  ) {
    this.generatePositionMappings();
  }

  private generatePositionMappings(): void {
    if (this.svSegments.length === 0) return;

    this.positionMappings = [];
    this.positionMappings.push({
      time: this.svSegments[0].startTime,
      position: 0,
      sv: this.svSegments[0].scrollVelocity,
    });

    for (let i = 0; i < this.svSegments.length - 1; i++) {
      const current = this.svSegments[i];
      const next = this.svSegments[i + 1];
      const duration = next.startTime - current.startTime;
      const length = (duration / this.timeRange) * current.scrollVelocity;

      this.positionMappings.push({
        time: next.startTime,
        position: this.positionMappings[this.positionMappings.length - 1].position + length,
        sv: next.scrollVelocity,
      });
    }
  }

  private relativePositionAt(time: number): number {
    if (this.positionMappings.length === 0) return time / this.timeRange;

    let lo = 0;
    let hi = this.positionMappings.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1;
      if (this.positionMappings[mid].time <= time) lo = mid;
      else hi = mid - 1;
    }

    const mapping = this.positionMappings[lo];
    return mapping.position + (time - mapping.time) / this.timeRange * mapping.sv;
  }

  getProgress(noteTime: number, currentTime: number): number {
    if (this.positionMappings.length === 0) {
      return 1 - (noteTime - currentTime) / this.timeRange;
    }

    const notePos = this.relativePositionAt(noteTime);
    const currentPos = this.relativePositionAt(currentTime);
    return 1 - (notePos - currentPos);
  }
}

import { TimingPoint } from "./osuParser";

export interface ScrollVelocitySegment {
  startTime: number;
  scrollVelocity: number;
}

export function extractScrollVelocitySegments(timingPoints: TimingPoint[]): ScrollVelocitySegment[] {
  const segments: ScrollVelocitySegment[] = [];
  let currentSV = 1.0;

  const sorted = [...timingPoints].sort((a, b) => a.time - b.time);

  for (const tp of sorted) {
    if (!tp.uninherited && tp.beatLength < 0) {
      const newSV = 100 / Math.abs(tp.beatLength);
      if (newSV !== currentSV) {
        currentSV = newSV;
        segments.push({ startTime: tp.time, scrollVelocity: currentSV });
      }
    }
  }

  if (segments.length === 0 || segments[0].startTime > 0) {
    segments.unshift({ startTime: 0, scrollVelocity: 1 });
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
    const positionDiff = notePos - currentPos;

    const visibleDistance = this.getVisibleDistance(currentTime);
    if (visibleDistance <= 0) return 1 - (noteTime - currentTime) / this.timeRange;

    return positionDiff / visibleDistance;
  }

  private getVisibleDistance(currentTime: number): number {
    const targetTime = currentTime - this.timeRange;

    if (this.positionMappings.length === 0) return 1;

    let lo = 0;
    let hi = this.positionMappings.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1;
      if (this.positionMappings[mid].time <= targetTime) lo = mid;
      else hi = mid - 1;
    }

    const mapping = this.positionMappings[lo];
    if (mapping.time > targetTime) return 1;

    const relativePos = mapping.position + (targetTime - mapping.time) / this.timeRange * mapping.sv;
    const currentPos = this.relativePositionAt(currentTime);
    const visibleDist = currentPos - relativePos;

    return visibleDist > 0 ? visibleDist : 1;
  }
}

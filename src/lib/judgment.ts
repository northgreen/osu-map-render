import { replay, hasReplay } from "./replay";
import { HitObject } from "./osuParser";
import { getKeyCount } from "../config";

// ============================================
// Judgment Mode: v1 (Classic), v2 (ScoreV2), or custom
// ============================================

export type JudgmentMode = "v1" | "v2" | "custom";

let currentJudgmentMode: JudgmentMode = "v1";
let currentJudgmentOffset: number = 0;

// Custom judgment windows (in ms)
interface CustomHitWindows {
  perfect?: number;
  great?: number;
  good?: number;
  ok?: number;
  meh?: number;
}

let currentCustomWindows: CustomHitWindows = {};

export function setJudgmentMode(mode: JudgmentMode): void {
  currentJudgmentMode = mode;
  clearJudgmentCache();
}

export function getJudgmentMode(): JudgmentMode {
  return currentJudgmentMode;
}

export function setJudgmentOffset(offset: number): void {
  if (currentJudgmentOffset !== offset) {
    currentJudgmentOffset = offset;
    clearJudgmentCache();
  }
}

export function getJudgmentOffset(): number {
  return currentJudgmentOffset;
}

export function setCustomWindows(windows: CustomHitWindows): void {
  currentCustomWindows = windows;
  clearJudgmentCache();
}

export function isAutoplayMode(): boolean {
  return !hasReplay;
}

export function getCustomWindows(): CustomHitWindows {
  return currentCustomWindows;
}

// ============================================
// DifficultyRange algorithm from osu
// ============================================

function difficultyRange(od: number, range: [number, number, number]): number {
  const [min, mid, max] = range;
  let result: number;
  if (od > 5) {
    result = mid + ((max - mid) * (od - 5)) / 5;
  } else if (od < 5) {
    result = mid + ((mid - min) * (od - 5)) / 5;
  } else {
    result = mid;
  }
  // osu uses Math.Floor(value) + 0.5
  return Math.floor(result) + 0.5;
}

// ============================================
// Hit Window Calculation
// ============================================

interface HitWindows {
  perfect: number;
  great: number;
  good: number;
  ok: number;
  meh: number;
  miss: number;
}

// v2 (ScoreV2): Uses DifficultyRange + floor + 0.5
function getHitWindowsV2(od: number): HitWindows {
  return {
    perfect: difficultyRange(od, [22.4, 19.4, 13.9]),
    great: difficultyRange(od, [64, 49, 34]),
    good: difficultyRange(od, [97, 82, 67]),
    ok: difficultyRange(od, [127, 112, 97]),
    meh: difficultyRange(od, [151, 136, 121]),
    miss: difficultyRange(od, [188, 173, 158]),
  };
}

// v1 (Classic, non-ScoreV2): Uses simplified formula + floor + 0.5
// Formula: base[od] + 3 * (10 - od), then floor + 0.5
function getHitWindowsV1(od: number): HitWindows {
  const base = [16, 34, 67, 97, 121, 158];
  const windows = base.map((d, index) => {
    if (index === 0) return d;
    return d + 3 * (10 - od);
  });

  return {
    perfect: Math.floor(windows[0]) + 0.5,
    great: Math.floor(windows[1]) + 0.5,
    good: Math.floor(windows[2]) + 0.5,
    ok: Math.floor(windows[3]) + 0.5,
    meh: Math.floor(windows[4]) + 0.5,
    miss: Math.floor(windows[5]) + 0.5,
  };
}

// Get hit windows based on current mode
export function getHitWindows(od: number): HitWindows {
  if (currentJudgmentMode === "custom") {
    // Use custom windows with fallback to v2 defaults
    return {
      perfect: currentCustomWindows.perfect ?? 19.5,
      great: currentCustomWindows.great ?? 49,
      good: currentCustomWindows.good ?? 82,
      ok: currentCustomWindows.ok ?? 112,
      meh: currentCustomWindows.meh ?? 136,
      miss: currentCustomWindows.meh ? currentCustomWindows.meh + 37 : 173,
    };
  }
  return currentJudgmentMode === "v2"
    ? getHitWindowsV2(od)
    : getHitWindowsV1(od);
}

// osu!mania judgment: Perfect(320), Great(300), Good(200), Ok(100), Meh(50), Miss
export type Judgment =
  | "Perfect"
  | "Great"
  | "Good"
  | "Ok"
  | "Meh"
  | "Miss"
  | null;

// Calculate judgment based on time difference and OD using osu algorithm
export function calculateJudgment(
  hitTime: number,
  noteTime: number,
  od: number,
): Judgment {
  // Apply judgment offset (positive = player hits early, negative = player hits late)
  const adjustedHitTime = hitTime - currentJudgmentOffset;
  const diff = Math.abs(adjustedHitTime - noteTime);
  const windows = getHitWindows(od);

  if (diff <= windows.perfect) return "Perfect";
  if (diff <= windows.great) return "Great";
  if (diff <= windows.good) return "Good";
  if (diff <= windows.ok) return "Ok";
  if (diff <= windows.meh) return "Meh";
  return "Miss";
}

// Get color for judgment
export function getJudgmentColor(judgment: Judgment): string {
  switch (judgment) {
    case "Perfect":
      return "#FF00FF"; // Magenta - 320
    case "Great":
      return "#00FF88"; // Green - 300
    case "Good":
      return "#00AAFF"; // Blue - 200
    case "Ok":
      return "#FFAA00"; // Orange - 100
    case "Meh":
      return "#FF4444"; // Red - 50
    case "Miss":
      return "#888888"; // Gray - 0
    default:
      return "#888888";
  }
}

// Get score value for judgment
export function getJudgmentScore(judgment: Judgment): number {
  switch (judgment) {
    case "Perfect":
      return 320;
    case "Great":
      return 300;
    case "Good":
      return 200;
    case "Ok":
      return 100;
    case "Meh":
      return 50;
    case "Miss":
      return 0;
    default:
      return 0;
  }
}

// ============================================
// Key Press Event Extraction
// ============================================

// Key press event
interface KeyPressEvent {
  time: number;
  column: number;
  isRelease: boolean;
}

// Extract key press events from replay
function getKeyPressEvents(): KeyPressEvent[] {
  if (!replay?.replayData) return [];

  const events: KeyPressEvent[] = [];
  const keyCount = getKeyCount();

  // Calculate cumulative times
  let cumulativeTime = 0;
  const times: number[] = [];

  for (let i = 0; i < replay.replayData.length; i++) {
    cumulativeTime += replay.replayData[i].timeOffset;
    times.push(cumulativeTime);
  }

  // Track key state per column
  const keyState = new Array(keyCount).fill(false);

  for (let i = 0; i < replay.replayData.length; i++) {
    const frame = replay.replayData[i];
    const currentTime = times[i];

    if (currentTime < 0) continue;

    const keys = frame.x;

    for (let col = 0; col < keyCount; col++) {
      const isPressed = (keys & (1 << col)) !== 0;

      if (isPressed && !keyState[col]) {
        keyState[col] = true;
        events.push({ time: currentTime, column: col, isRelease: false });
      } else if (!isPressed && keyState[col]) {
        keyState[col] = false;
        events.push({ time: currentTime, column: col, isRelease: true });
      }
    }
  }

  return events;
}

// ============================================
// Judgment Result
// ============================================

// Judgment result for display
export interface JudgmentResult {
  noteTime: number;
  column: number;
  judgment: Judgment;
  hitTime: number;
  isLongNote: boolean;
  endTime?: number;
}

// ============================================
// Key Press Intervals (for ReplayCursor)
// ============================================

interface KeyInterval {
  start: number;
  end: number;
  column: number;
}

let keyIntervalsCache: KeyInterval[] | null = null;

function getKeyPressIntervals(hitObjects?: HitObject[]): KeyInterval[] {
  const intervals: KeyInterval[] = [];

  // Autoplay mode: generate key intervals for all notes
  if (isAutoplayMode()) {
    if (hitObjects) {
      const sortedNotes = [...hitObjects].sort((a, b) => a.time - b.time);
      for (const note of sortedNotes) {
        intervals.push({
          start: note.time,
          end: note.endTime ?? note.time + 100,
          column: note.column,
        });
      }
    }
    return intervals;
  }

  if (!replay?.replayData) return intervals;

  const keyCount = getKeyCount();

  // Calculate cumulative times
  let cumulativeTime = 0;
  const times: number[] = [];

  for (let i = 0; i < replay.replayData.length; i++) {
    cumulativeTime += replay.replayData[i].timeOffset;
    times.push(cumulativeTime);
  }

  // Track key state per column
  const keyState = new Array(keyCount).fill(false);
  const keyStartTime = new Array(keyCount).fill(0);

  for (let i = 0; i < replay.replayData.length; i++) {
    const frame = replay.replayData[i];
    const currentTime = times[i];
    const keys = frame.x;

    for (let col = 0; col < keyCount; col++) {
      const isPressed = (keys & (1 << col)) !== 0;

      if (isPressed && !keyState[col]) {
        keyState[col] = true;
        keyStartTime[col] = currentTime;
      } else if (!isPressed && keyState[col]) {
        keyState[col] = false;
        if (keyStartTime[col] > 0) {
          intervals.push({
            start: keyStartTime[col],
            end: currentTime,
            column: col,
          });
        }
      }
    }
  }

  return intervals;
}

export function getKeyIntervals(hitObjects?: HitObject[]): KeyInterval[] {
  if (keyIntervalsCache) return keyIntervalsCache;
  keyIntervalsCache = getKeyPressIntervals(hitObjects);
  return keyIntervalsCache;
}

// ============================================
// Main Judgment Calculation
// ============================================

// Match key presses to notes and calculate judgments
export function calculateJudgments(
  hitObjects: HitObject[],
  od: number,
): JudgmentResult[] {
  // Autoplay mode: all notes hit as Perfect
  if (isAutoplayMode()) {
    const sortedNotes = [...hitObjects].sort((a, b) => a.time - b.time);
    const results: JudgmentResult[] = [];

    for (const note of sortedNotes) {
      // Head judgment
      results.push({
        noteTime: note.time,
        column: note.column,
        judgment: "Perfect" as Judgment,
        hitTime: note.time,
        isLongNote: note.isLongNote,
        endTime: note.endTime,
      });
      // LN tail judgment
      if (note.isLongNote && note.endTime) {
        results.push({
          noteTime: note.endTime,
          column: note.column,
          judgment: "Perfect" as Judgment,
          hitTime: note.endTime,
          isLongNote: true,
          endTime: note.endTime,
        });
      }
    }

    results.sort((a, b) => a.noteTime - b.noteTime);
    return results;
  }

  const events = getKeyPressEvents();

  // Get the hit windows
  const windows = getHitWindows(od);
  const missWindow = windows.miss;

  // Sort hitObjects by time
  const sortedNotes = [...hitObjects].sort((a, b) => a.time - b.time);

  const results: JudgmentResult[] = [];
  const pressEvents = events.filter((e) => !e.isRelease);
  const releaseEvents = events.filter((e) => e.isRelease);

  // Track which notes have been hit (by index in sortedNotes)
  const hitNotes = new Set<number>();
  const hitTails = new Set<number>();

  // First pass: process key presses (head judgments)
  for (const event of pressEvents) {
    // Find all notes that could be hit (within miss window AFTER the note)
    const candidates: { note: HitObject; index: number; diff: number }[] = [];

    for (let i = 0; i < sortedNotes.length; i++) {
      const note = sortedNotes[i];
      if (hitNotes.has(i)) continue;

      const diff = event.time - note.time;

      // Different column - skip
      if (note.column !== event.column) {
        continue;
      }

      // Only consider notes that are at or before the key press (diff >= 0 means key is at/after note)
      // But we allow some early hits (negative diff)
      if (diff < -missWindow) {
        // Too early - stop here (no later notes can be hit)
        break;
      }

      // Allow hits from -missWindow (early) to +missWindow (late)
      if (Math.abs(diff) <= missWindow) {
        candidates.push({ note, index: i, diff });
      }
    }

    if (candidates.length > 0) {
      // Choose the closest one - prefer notes that are hit AFTER (positive diff = key press after note time)
      // Among those, choose the smallest positive diff (earliest note after key press)
      // If no positive diff, choose the one with smallest absolute diff (earliest before key press)
      const closest = candidates.reduce((a, b) => {
        // Prefer positive diff (note is before key press)
        if (a.diff >= 0 && b.diff < 0) return a;
        if (a.diff < 0 && b.diff >= 0) return b;
        // Both same sign - choose smaller absolute diff
        return Math.abs(a.diff) < Math.abs(b.diff) ? a : b;
      });

      const judgment = calculateJudgment(event.time, closest.note.time, od);
      hitNotes.add(closest.index);

      results.push({
        noteTime: closest.note.time,
        column: closest.note.column,
        judgment,
        hitTime: event.time,
        isLongNote: closest.note.isLongNote,
        endTime: closest.note.endTime,
      });
    }
  }

  // Second pass: process key releases for LN tails
  for (const event of releaseEvents) {
    let candidate: { note: HitObject; index: number } | null = null;
    let closestDiff = Infinity;

    for (let i = 0; i < sortedNotes.length; i++) {
      const note = sortedNotes[i];
      // Only LNs that have been started (head hit)
      if (!note.isLongNote || !note.endTime) continue;
      if (!hitNotes.has(i)) continue; // Head must be hit first
      if (hitTails.has(i)) continue;
      if (note.column !== event.column) continue;

      const diff = Math.abs(note.endTime - event.time);
      if (diff < closestDiff) {
        closestDiff = diff;
        candidate = { note, index: i };
      }
    }

    if (candidate && candidate.note.endTime) {
      const endTime = candidate.note.endTime;
      if (Math.abs(endTime - event.time) <= missWindow) {
        const judgment = calculateJudgment(event.time, endTime, od);
        hitTails.add(candidate.index);

        results.push({
          noteTime: endTime,
          column: candidate.note.column,
          judgment,
          hitTime: event.time,
          isLongNote: true,
          endTime,
        });
      }
    }
  }

  // Add misses for notes that weren't hit
  for (let i = 0; i < sortedNotes.length; i++) {
    const note = sortedNotes[i];

    // Check head miss
    if (!hitNotes.has(i)) {
      results.push({
        noteTime: note.time,
        column: note.column,
        judgment: "Miss",
        hitTime: note.time,
        isLongNote: note.isLongNote,
        endTime: note.endTime,
      });
    }

    // Check LN tail miss
    if (note.isLongNote && note.endTime && !hitTails.has(i)) {
      results.push({
        noteTime: note.endTime,
        column: note.column,
        judgment: "Miss",
        hitTime: note.endTime,
        isLongNote: true,
        endTime: note.endTime,
      });
    }
  }

  // Sort by time
  results.sort((a, b) => a.noteTime - b.noteTime);

  return results;
}

// Cache for judgment results
let judgmentCache: JudgmentResult[] | null = null;

export function getJudgmentResults(
  hitObjects: HitObject[],
  od: number,
): JudgmentResult[] {
  if (judgmentCache) return judgmentCache;
  judgmentCache = calculateJudgments(hitObjects, od);
  return judgmentCache;
}

// Clear cache (call when beatmap changes or mode changes)
export function clearJudgmentCache(): void {
  judgmentCache = null;
  keyIntervalsCache = null;
}

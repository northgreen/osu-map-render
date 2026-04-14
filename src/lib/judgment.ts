import { replay } from "./replay";
import { HitObject } from "../osuParser";

// osu!mania hit window algorithm from ManiaHitWindows.cs
// Uses DifficultyRange: (od, range) =>
//   od > 5: mid + (max - mid) * (od - 5) / 5
//   od < 5: mid + (mid - min) * od / 5
//   od = 5: mid

function difficultyRange(od: number, range: [number, number, number]): number {
  const [min, mid, max] = range;
  let result: number;
  if (od > 5) {
    result = mid + (max - mid) * (od - 5) / 5;
  } else if (od < 5) {
    result = mid + (mid - min) * od / 5;
  } else {
    result = mid;
  }
  // osu uses Math.Floor(value) + 0.5
  return Math.floor(result) + 0.5;
}

// Hit window configurations for osu!mania (in ms) based on OD
// From osu! wiki: 判定区间取决于谱面的判定严度 (OD)
function getHitWindows(od: number) {
  // PERFECT/GREAT/GOOD/OK/MEH/MISS windows (in ms)
  const perfect = difficultyRange(od, [22.4, 19.4, 13.9]);
  const great = difficultyRange(od, [64, 49, 34]);
  const good = difficultyRange(od, [97, 82, 67]);
  const ok = difficultyRange(od, [127, 112, 97]);
  const meh = difficultyRange(od, [151, 136, 121]);
  const miss = difficultyRange(od, [188, 173, 158]);

  return { perfect, great, good, ok, meh, miss };
}

// osu!mania judgment: Perfect(320), Great(300), Good(200), Ok(100), Meh(50), Miss
export type Judgment = "Perfect" | "Great" | "Good" | "Ok" | "Meh" | "Miss" | null;

// Calculate judgment based on time difference and OD using osu algorithm
export function calculateJudgment(
  hitTime: number,
  noteTime: number,
  od: number
): Judgment {
  const diff = Math.abs(hitTime - noteTime);
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
    case "Perfect": return "#FF00FF"; // Magenta - 320
    case "Great": return "#00FF88";   // Green - 300
    case "Good": return "#00AAFF";    // Blue - 200
    case "Ok": return "#FFAA00";      // Orange - 100
    case "Meh": return "#FF4444";     // Red - 50
    case "Miss": return "#888888";     // Gray - 0
    default: return "#888888";
  }
}

// Get score value for judgment
export function getJudgmentScore(judgment: Judgment): number {
  switch (judgment) {
    case "Perfect": return 320;
    case "Great": return 300;
    case "Good": return 200;
    case "Ok": return 100;
    case "Meh": return 50;
    case "Miss": return 0;
    default: return 0;
  }
}

// Key press event
interface KeyPressEvent {
  time: number;
  column: number;
  isRelease: boolean;
}

// Judgment result for display
export interface JudgmentResult {
  noteTime: number;
  column: number;
  judgment: Judgment;
  hitTime: number;
  isLongNote: boolean;
  endTime?: number;
}

// Extract key press events from replay
function getKeyPressEvents(): KeyPressEvent[] {
  if (!replay?.replayData) return [];

  const events: KeyPressEvent[] = [];

  // Calculate cumulative times - just sum up timeOffsets like osu does
  // The replay time starts at negative (before song) and goes positive
  let cumulativeTime = 0;
  const times: number[] = [];

  for (let i = 0; i < replay.replayData.length; i++) {
    cumulativeTime += replay.replayData[i].timeOffset;
    times.push(cumulativeTime);
  }

  // Debug: show first few times
  console.log("First 10 replay times:", times.slice(0, 10));

  // Track key state per column
  const keyState = [false, false, false, false];

  for (let i = 0; i < replay.replayData.length; i++) {
    const frame = replay.replayData[i];
    const currentTime = times[i];

    // Skip negative time frames (before song start, like SkipBoundary)
    if (currentTime < 0) continue;

    const keys = frame.x; // Use x field for mania key press bitmask

    for (let col = 0; col < 4; col++) {
      const isPressed = (keys & (1 << col)) !== 0;

      if (isPressed && !keyState[col]) {
        // Key just pressed
        keyState[col] = true;
        events.push({ time: currentTime, column: col, isRelease: false });
      } else if (!isPressed && keyState[col]) {
        // Key just released
        keyState[col] = false;
        events.push({ time: currentTime, column: col, isRelease: true });
      }
    }
  }

  return events;
}

// Constants matching Mania-Replay-Master
const IGNORE = 3;
const TOO_EARLY = -1;
const TOO_LATE = 2;
const HIT = 0;
const HIT_AND_CAN_HIT_AGAIN = 1;

// Match key presses to notes and calculate judgments
export function calculateJudgments(
  hitObjects: HitObject[],
  od: number
): JudgmentResult[] {
  const events = getKeyPressEvents();

  // Get the hit windows
  const windows = getHitWindows(od);
  const missWindow = windows.miss;

  // Sort hitObjects by time
  const sortedNotes = [...hitObjects].sort((a, b) => a.time - b.time);

  const results: JudgmentResult[] = [];
  const pressEvents = events.filter(e => !e.isRelease);
  const releaseEvents = events.filter(e => e.isRelease);

  // Track which notes have been hit (by index in sortedNotes)
  const hitNotes = new Set<number>();
  const hitTails = new Set<number>();
  const cannotJudge = new Set<number>();

  // First pass: process key presses (head judgments)
  for (const event of pressEvents) {
    let candidate: { note: HitObject; index: number } | null = null;
    let shouldDeleteIndex: number | null = null;

    for (let i = 0; i < sortedNotes.length; i++) {
      const note = sortedNotes[i];
      if (hitNotes.has(i)) continue;

      const diff = event.time - note.time;

      // Different column
      if (note.column !== event.column) {
        continue;
      }

      // Too early: action is more than miss window before note
      if (-diff > missWindow) {
        // Too early - break, no later notes can be hit either
        break;
      }

      // Check if too late
      let isTooLate = false;
      if (note.isLongNote && note.endTime) {
        // For LN, check if action time is too late relative to end time
        if (event.time - note.endTime > windows.ok) {
          isTooLate = true;
        }
      } else {
        // For regular notes
        if (diff >= windows.ok) {
          isTooLate = true;
        }
      }

      if (isTooLate) {
        // Too late - mark for removal
        shouldDeleteIndex = i;
        continue;
      }

      // Hit!
      candidate = { note, index: i };
      if (note.isLongNote && note.endTime) {
        // For LN, may be able to hit again (hold) - don't remove yet
      } else {
        hitNotes.add(i);
      }
      break;
    }

    // Remove notes marked as too late
    if (shouldDeleteIndex !== null) {
      cannotJudge.add(shouldDeleteIndex);
    }

    if (candidate) {
      const judgment = calculateJudgment(event.time, candidate.note.time, od);
      hitNotes.add(candidate.index);

      results.push({
        noteTime: candidate.note.time,
        column: candidate.note.column,
        judgment,
        hitTime: event.time,
        isLongNote: candidate.note.isLongNote,
        endTime: candidate.note.endTime,
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

    if (candidate && Math.abs(candidate.note.endTime - event.time) <= missWindow) {
      const judgment = calculateJudgment(event.time, candidate.note.endTime, od);
      hitTails.add(candidate.index);

      results.push({
        noteTime: candidate.note.endTime,
        column: candidate.note.column,
        judgment,
        hitTime: event.time,
        isLongNote: true,
        endTime: candidate.note.endTime,
      });
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

  // Debug: print final statistics
  const counts = { Perfect: 0, Great: 0, Good: 0, Ok: 0, Meh: 0, Miss: 0 };
  for (const r of results) {
    if (r.judgment && counts[r.judgment as keyof typeof counts] !== undefined) {
      counts[r.judgment as keyof typeof counts]++;
    }
  }
  console.log("=== Judgment Stats (v2) ===");
  console.log(`Perfect: ${counts.Perfect}x320`);
  console.log(`Great: ${counts.Great}x300`);
  console.log(`Good: ${counts.Good}x200`);
  console.log(`Ok: ${counts.Ok}x100`);
  console.log(`Meh: ${counts.Meh}x50`);
  console.log(`Miss: ${counts.Miss}xMiss`);
  console.log(`Total: ${counts.Perfect * 320 + counts.Great * 300 + counts.Good * 200 + counts.Ok * 100 + counts.Meh * 50}`);

  return results;
}

// Cache for judgment results
let judgmentCache: JudgmentResult[] | null = null;

export function getJudgmentResults(
  hitObjects: HitObject[],
  od: number
): JudgmentResult[] {
  if (judgmentCache) return judgmentCache;
  judgmentCache = calculateJudgments(hitObjects, od);
  return judgmentCache;
}

// Clear cache (call when beatmap changes)
export function clearJudgmentCache(): void {
  judgmentCache = null;
}
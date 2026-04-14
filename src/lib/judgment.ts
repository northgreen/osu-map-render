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

// Match key presses to notes and calculate judgments
export function calculateJudgments(
  hitObjects: HitObject[],
  od: number
): JudgmentResult[] {
  const events = getKeyPressEvents();

  // Get the miss window (max time difference for a hit)
  const windows = getHitWindows(od);
  const maxHitWindow = windows.miss; // Use miss window as max matching window (~158-188ms)

  // Debug: log first few events and notes
  if (events.length > 0) {
    console.log("First 5 key events:", events.slice(0, 5).map(e => ({ time: Math.round(e.time), column: e.column, isRelease: e.isRelease })));
    console.log("First 5 note times:", hitObjects.slice(0, 5).map(n => ({ time: n.time, column: n.column, isLN: n.isLongNote })));
    console.log("Max hit window:", maxHitWindow);
    console.log("OD:", od, "Miss window:", maxHitWindow);
  }

  const results: JudgmentResult[] = [];
  const pressEvents = events.filter(e => !e.isRelease);
  const releaseEvents = events.filter(e => e.isRelease);

  // Track which notes have been hit
  const hitNotes = new Set<number>();
  const hitTails = new Set<number>();

  // First pass: process key presses (head judgments)
  for (const event of pressEvents) {
    // Find the closest note in this column that hasn't been hit, within hit window
    let closestNote: HitObject | null = null;
    let closestDiff = Infinity;
    let closestIndex = -1;

    for (let i = 0; i < hitObjects.length; i++) {
      const note = hitObjects[i];
      if (note.column !== event.column) continue;
      if (hitNotes.has(i)) continue;

      const diff = Math.abs(note.time - event.time);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestNote = note;
        closestIndex = i;
      }
    }

    // Debug: log first few unmatched events
    if (closestNote && closestDiff > maxHitWindow && results.length < 3) {
      console.log("Event too far from note:", { eventTime: event.time, noteTime: closestNote?.time, diff: closestDiff, window: maxHitWindow });
    }

    // Only consider if within miss window
    if (closestNote && closestDiff <= maxHitWindow) {
      const judgment = calculateJudgment(event.time, closestNote.time, od);
      hitNotes.add(closestIndex);

      results.push({
        noteTime: closestNote.time,
        column: closestNote.column,
        judgment,
        hitTime: event.time,
        isLongNote: closestNote.isLongNote,
        endTime: closestNote.endTime,
      });
    }
  }

  // Second pass: process key releases for LN tails
  // Only consider LNs whose head was already hit
  for (const event of releaseEvents) {
    // Find the closest LN tail in this column that hasn't been hit, AND whose head was hit
    let closestNote: HitObject | null = null;
    let closestDiff = Infinity;
    let closestIndex = -1;

    for (let i = 0; i < hitObjects.length; i++) {
      const note = hitObjects[i];
      // Only LNs that have been started (head hit)
      if (!note.isLongNote || !note.endTime) continue;
      if (!hitNotes.has(i)) continue; // Head must be hit first
      if (note.column !== event.column) continue;
      if (hitTails.has(i)) continue;

      const diff = Math.abs(note.endTime - event.time);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestNote = note;
        closestIndex = i;
      }
    }

    // Only consider if within miss window
    if (closestNote && closestDiff <= maxHitWindow) {
      const judgment = calculateJudgment(event.time, closestNote.endTime!, od);
      hitTails.add(closestIndex);

      results.push({
        noteTime: closestNote.endTime!, // Use endTime for tail
        column: closestNote.column,
        judgment,
        hitTime: event.time,
        isLongNote: true,
        endTime: closestNote.endTime,
      });
    }
  }

  // Find the last key event time to determine which notes should have been judged
  const allTimes = events.map(e => e.time);
  const lastEventTime = allTimes.length > 0 ? Math.max(...allTimes) : 0;

  // Add misses for notes that weren't hit and have passed the miss window
  for (let i = 0; i < hitObjects.length; i++) {
    const note = hitObjects[i];

    // Check head miss - only if note has passed the miss window relative to last key event
    // and the note was within replay time range
    if (!hitNotes.has(i) && note.time + windows.miss < lastEventTime) {
      results.push({
        noteTime: note.time,
        column: note.column,
        judgment: "Miss",
        hitTime: note.time,
        isLongNote: note.isLongNote,
        endTime: note.endTime,
      });
    }

    // Check LN tail miss - only if tail has passed miss window
    if (note.isLongNote && note.endTime && !hitTails.has(i) && note.endTime + windows.miss < lastEventTime) {
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
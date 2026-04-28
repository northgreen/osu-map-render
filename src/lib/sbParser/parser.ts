import * as fs from "fs";

// Import types for internal use (parsing functions need them)
import type {
  SbCommand,
  SbObject,
  SbSample,
  ParsedStoryboard,
  Layer,
  Origin,
  CommandType,
} from "./types";
import { INFINITE_DURATION } from "./types";

// Re-export all types/constants from the browser-safe types module
export {
  INFINITE_DURATION,
  EASING_NAMES,
  type Layer,
  type Origin,
  type CommandType,
  type SbCommand,
  type SbLoop,
  type SbObject,
  type SbSample,
  type ParsedStoryboard,
} from "./types";

// Convert radians (osu! file format) to degrees (internal representation)
const RAD_TO_DEG = 180 / Math.PI;

// Valid animation loop types for validation
const VALID_LOOP_TYPES = ["LoopForever", "LoopOnce"] as const;

// Maximum coordinate value in osu! storyboard
const MAX_COORDINATE_VALUE = 131072;

function clampCoord(val: number): number {
  return Math.min(Math.max(val, -MAX_COORDINATE_VALUE), MAX_COORDINATE_VALUE);
}

/**
 * Calculate loop duration from the span of child command times.
 * Returns max(endTime) - min(startTime), defaulting to 1000ms when <= 0.
 */
function calculateLoopDuration(commands: SbCommand[]): number {
  let minStart = Infinity;
  let maxEnd = -Infinity;
  for (const cmd of commands) {
    if (cmd.startTime < minStart) minStart = cmd.startTime;
    if (cmd.endTime > maxEnd && cmd.endTime !== INFINITE_DURATION) {
      maxEnd = cmd.endTime;
    }
  }
  let loopDuration = maxEnd - minStart;
  if (loopDuration <= 0) loopDuration = 1000;
  return loopDuration;
}

// ============================================
// Parsing Helpers
// ============================================

const layers: Record<number, Layer> = {
  0: "Background",
  1: "Fail",
  2: "Pass",
  3: "Foreground",
  4: "Overlay",
};

function parseLayer(value: string | number): Layer {
  // Handle string layer names directly (osu! format)
  if (typeof value === "string") {
    const validLayers: Layer[] = ["Background", "Fail", "Pass", "Foreground", "Overlay"];
    if (validLayers.includes(value as Layer)) {
      return value as Layer;
    }
    // Try parsing as number
    const numValue = parseInt(value);
    if (!isNaN(numValue)) {
      return layers[numValue] || "Background";
    }
    return "Background";
  }
  // Handle numeric layer IDs
  return layers[value] || "Background";
}

function parseOrigin(value: string | number): Origin {
  const origins: Record<number, Origin> = {
    0: "TopLeft",
    1: "Centre",
    2: "CentreLeft",
    3: "TopRight",
    4: "BottomCentre",
    5: "TopCentre",
    6: "TopLeft", // Custom (same as TopLeft)
    7: "CentreRight",
    8: "BottomLeft",
    9: "BottomRight",
  };

  // Valid string origin names from .osu/.osb files
  const originNames: Origin[] = [
    "TopLeft", "Centre", "CentreLeft", "TopRight",
    "BottomCentre", "TopCentre", "CentreRight",
    "BottomLeft", "BottomRight",
  ];

  // Handle string origin names directly
  if (typeof value === "string") {
    // Check if it's a valid origin name
    if (originNames.includes(value as Origin)) {
      return value as Origin;
    }
    // Fall back to numeric parsing
    const num = parseInt(value);
    if (!isNaN(num)) {
      return origins[num] || "Centre";
    }
  }

  if (typeof value === "number") {
    return origins[value] || "Centre";
  }

  return "Centre";
}

function parseCommand(line: string, variables: Record<string, string> = {}): SbCommand[] | null {
  // Remove leading underscore if present
  const cleanLine = line.replace(/^_/, "");
  // FIX #8: Substitute variables BEFORE splitting so multi-value vars (e.g., $colour=0,255,0) split correctly
  const substitutedLine = substituteVariables(cleanLine, variables);
  const parts = substitutedLine.split(",").map(p => p.trim());


  if (parts.length < 3) return null;

  const type = parts[0].trim() as CommandType;
  const easing = parseInt(parts[1]) || 0;
  const startTime = parseInt(parts[2]) || 0;

  // Determine end time and params based on command type
  let endTime = startTime;
  let params: number[] = [];

  switch (type) {
    case "F": // Fade: type,easing,start,end,startVal,endVal
      // osu! behavior: if endTime is empty, set it to startTime (instant change)
      if (parts[3] === undefined || parts[3] === "") {
        endTime = startTime; // Instant change
      } else {
        endTime = parseFloat(parts[3]) || startTime;
      }
      // Parse fade values
      // osu! behavior: single value means endValue = startValue (maintain during command period)
      // After endTime, the last value persists (not 0)
      if (parts[5] === undefined || parts[5] === "") {
        // Single value: maintain startValue during [startTime, endTime], endValue = startValue
        const fValue = parseFloat(parts[4]);
        params = [
          isNaN(fValue) ? 0 : fValue,
          isNaN(fValue) ? 0 : fValue, // endValue = startValue
        ];
      } else {
        // Two values: fade from startVal to endVal
        const fStart = parseFloat(parts[4]);
        const fEnd = parseFloat(parts[5]);
        params = [
          isNaN(fStart) ? 0 : fStart,
          isNaN(fEnd) ? fStart : fEnd,
        ];
      }
      break;
    case "M": // Move: type,easing,start,end,x1,y1,x2,y2
      // If endTime is empty/omitted, treat as instant change (endTime = startTime)
      // This matches osu! stable behavior
      if (parts[3] === undefined || parts[3] === "") {
        endTime = startTime;
      } else {
        endTime = parseInt(parts[3]) || startTime;
      }
      // Check if x2,y2 are provided (4-param) or only x1,y1 (2-param, no animation)
      if (parts[6] !== undefined && parts[6] !== "") {
        // 4-param: animate from (x1,y1) to (x2,y2)
        params = [
          parseFloat(parts[4]) || 0,
          parseFloat(parts[5]) || 0,
          parseFloat(parts[6]) || 0,
          parseFloat(parts[7]) || 0,
        ];
      } else {
        // 2-param: just set position, no animation
        params = [
          parseFloat(parts[4]) || 0,
          parseFloat(parts[5]) || 0,
        ];
      }
      break;
    case "MX": // MoveX: type,easing,start,end,x1
      // If endTime is empty/omitted, treat as instant change (endTime = startTime)
      if (parts[3] === undefined || parts[3] === "") {
        endTime = startTime;
      } else {
        endTime = parseInt(parts[3]) || startTime;
      }
      // Single param (x1) means just set position, no animation
      if (parts[5] === undefined || parts[5] === "") {
        params = [parseFloat(parts[4]) || 0];
      } else {
        // Two params: animate from x1 to x2
        params = [
          parseFloat(parts[4]) || 0,
          parseFloat(parts[5]) || 0,
        ];
      }
      break;
    case "MY": // MoveY: type,easing,start,end,y1
      // If endTime is empty/omitted, treat as instant change (endTime = startTime)
      if (parts[3] === undefined || parts[3] === "") {
        endTime = startTime;
      } else {
        endTime = parseInt(parts[3]) || startTime;
      }
      // Single param (y1) means just set position, no animation
      if (parts[5] === undefined || parts[5] === "") {
        params = [parseFloat(parts[4]) || 0];
      } else {
        // Two params: animate from y1 to y2
        params = [
          parseFloat(parts[4]) || 0,
          parseFloat(parts[5]) || 0,
        ];
      }
      break;
    case "S": // Scale: type,easing,start,end,startScale,endScale
      // osu! behavior: if endTime is empty, set it to startTime (instant change)
      // See: https://github.com/ppy/osu/blob/master/osu.Game/Beatmaps/Formats/LegacyStoryboardDecoder.cs#L210-L211
      if (parts[3] === undefined || parts[3] === "") {
        endTime = startTime; // Instant change
      } else {
        endTime = parseFloat(parts[3]) || startTime;
      }
      // Parse scale values
      if (parts[5] === undefined || parts[5] === "") {
        // Single value: startValue = endValue = this value (no interpolation)
        // Matches osu! behavior: endValue = split.Length > 5 ? ParseFloat(split[5]) : startValue
        const sValue = parseFloat(parts[4]);
        params = [
          isNaN(sValue) ? 1 : sValue,
          isNaN(sValue) ? 1 : sValue,
        ];
      } else {
        // Two values: scale from startVal to endVal
        const sStart = parseFloat(parts[4]);
        const sEnd = parseFloat(parts[5]);
        params = [
          isNaN(sStart) ? 1 : sStart,
          isNaN(sEnd) ? sStart : sEnd,
        ];
      }
      break;
    case "V": // Vector Scale: type,easing,start,end,sx1,sy1,sx2,sy2
      // osu! behavior: if endTime is empty, set it to startTime (instant change)
      if (parts[3] === undefined || parts[3] === "") {
        endTime = startTime; // Instant change
      } else {
        endTime = parseFloat(parts[3]) || startTime;
      }
      // Parse vector scale values
      if (parts[6] === undefined || parts[6] === "") {
        // Only x1,y1: scale from (1,1) to (x1,y1)
        const vx = parseFloat(parts[4]);
        const vy = parseFloat(parts[5]);
        params = [
          isNaN(vx) ? 1 : vx,
          isNaN(vy) ? 1 : vy,
          isNaN(vx) ? 1 : vx,
          isNaN(vy) ? 1 : vy,
        ];
      } else {
        // Four params: scale from (x1,y1) to (x2,y2)
        const vx1 = parseFloat(parts[4]);
        const vy1 = parseFloat(parts[5]);
        const vx2 = parseFloat(parts[6]);
        const vy2 = parseFloat(parts[7]);
        params = [
          isNaN(vx1) ? 1 : vx1,
          isNaN(vy1) ? 1 : vy1,
          isNaN(vx2) ? (isNaN(vx1) ? 1 : vx1) : vx2,
          isNaN(vy2) ? (isNaN(vy1) ? 1 : vy1) : vy2,
        ];
      }
      break;
    case "R": { // Rotate: type,easing,start,end,startDeg,endDeg (degrees)
      // osu! behavior: if endTime is empty, set it to startTime (instant change)
      if (parts[3] === undefined || parts[3] === "") {
        endTime = startTime; // Instant change
      } else {
        endTime = parseFloat(parts[3]) || startTime;
      }
      // .osu file format stores radians; convert to degrees for internal use
      if (parts[5] === undefined || parts[5] === "") {
        // Single value: rotate from 0 to that value (or stay at that value if endTime == startTime)
        const rValue = parseFloat(parts[4]);
        params = [
          isNaN(rValue) ? 0 : rValue * RAD_TO_DEG,
          isNaN(rValue) ? 0 : rValue * RAD_TO_DEG,
        ];
      } else {
        // Two values: rotate from startVal to endVal
        const rStart = parseFloat(parts[4]);
        const rEnd = parseFloat(parts[5]);
        params = [
          isNaN(rStart) ? 0 : rStart * RAD_TO_DEG,
          isNaN(rEnd) ? rStart : rEnd * RAD_TO_DEG,
        ];
      }
      break;
    }
    case "C": // Color: type,easing,start,end,r1,g1,b1,r2,g2,b2
      // osu! behavior: if endTime is empty, set it to startTime (instant change)
      if (parts[3] === undefined || parts[3] === "") {
        endTime = startTime; // Instant change
      } else {
        endTime = parseFloat(parts[3]) || startTime;
      }
      // Check if end color is provided (6 params) or only start color (3 params)
      if (parts[7] === undefined || parts[7] === "") {
        // Only r1,g1,b1: stay at that color
        const cr = parseFloat(parts[4]);
        const cg = parseFloat(parts[5]);
        const cb = parseFloat(parts[6]);
        params = [
          isNaN(cr) ? 255 : cr,
          isNaN(cg) ? 255 : cg,
          isNaN(cb) ? 255 : cb,
          isNaN(cr) ? 255 : cr,
          isNaN(cg) ? 255 : cg,
          isNaN(cb) ? 255 : cb,
        ];
      } else {
        // Six params: color from (r1,g1,b1) to (r2,g2,b2)
        const cr1 = parseFloat(parts[4]);
        const cg1 = parseFloat(parts[5]);
        const cb1 = parseFloat(parts[6]);
        const cr2 = parseFloat(parts[7]);
        const cg2 = parseFloat(parts[8]);
        const cb2 = parseFloat(parts[9]);
        params = [
          isNaN(cr1) ? 255 : cr1,
          isNaN(cg1) ? 255 : cg1,
          isNaN(cb1) ? 255 : cb1,
          isNaN(cr2) ? (isNaN(cr1) ? 255 : cr1) : cr2,
          isNaN(cg2) ? (isNaN(cg1) ? 255 : cg1) : cg2,
          isNaN(cb2) ? (isNaN(cb1) ? 255 : cb1) : cb2,
        ];
      }
      break;
    case "P": // Parameter: type,easing,start,end,param
      // P command is handled in the main loop, not here
      return null;
    default:
      return null;
  }

  const baseCmd: SbCommand = {
    type,
    easing,
    startTime,
    endTime,
    params,
  };

  // FIX #5: Expand shorthand 1 (multi-value sequence) for single-axis commands
  // e.g., F,0,51000,52000,0,1,0.5,1,0 -> 4 F commands
  if (params.length > 2 && (type === "F" || type === "S" || type === "R")) {
    const duration = endTime - startTime;
    const expanded: SbCommand[] = [];
    for (let i = 0; i < params.length - 1; i++) {
      expanded.push({
        type,
        easing,
        startTime: startTime + i * duration,
        endTime: startTime + (i + 1) * duration,
        params: [params[i], params[i + 1]],
      });
    }
    return expanded;
  }

  return [baseCmd];
}

// Helper function to substitute variables in strings
function substituteVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\$(\w+)/g, (match, varName) => {
    return variables[varName] !== undefined ? variables[varName] : match;
  });
}

// ============================================
// Main Parser
// ============================================

// Removed fixLoopRepeatCount - osu! L commands always use the command time span
// as the loop duration, and commands are executed at their specified times in each iteration.
// For example: L,0,3 with F,0,131434,132108 means:
//   loopDuration = 132108 - 131434 = 674ms
//   Iteration 0: F at 131434-132108
//   Iteration 1: F at 131434+674 - 132108+674 = 132108-132782
//   Iteration 2: F at 131434+2*674 - 132108+2*674 = 132782-133456
//   Iteration 3: F at 131434+3*674 - 132108+3*674 = 133456-134130
// Total iterations = repeatCount + 1 = 4

export function parseStoryboard(content: string): ParsedStoryboard {
  const lines = content.split(/\r?\n/);
  const objects: SbObject[] = [];
  const samples: SbSample[] = [];
  const variables: Record<string, string> = {};
  let currentObject: SbObject | null = null;
  let maxTime = 0;

  // Track loop and trigger groups for command expansion
  interface LoopContext {
    startTime: number;
    repeatCount: number;
    childCommands: SbCommand[];
    loopDuration: number;
  }
  let currentLoop: LoopContext | null = null;

  interface TriggerContext {
    name: string;
    startTime: number;
    endTime: number;
    childCommands: SbCommand[];
    groupNumber?: number;
  }
  let currentTrigger: TriggerContext | null = null;

  for (let i = 0; i < lines.length; i++) {
    const originalLine = lines[i];
    const line = lines[i].trim();

    // Skip empty lines and comments
    if (!line || line.startsWith("//")) continue;

    // Calculate depth: count leading spaces and underscores (same as osu! stable)
    let depth = 0;
    for (let j = 0; j < originalLine.length; j++) {
      if (originalLine[j] === ' ' || originalLine[j] === '_') {
        depth++;
      } else {
        break;
      }
    }

    // Check if line is inside a loop (depth >= 2 per osu! stable)
    // depth 0 = Sprite/Animation, depth 1 = regular command, depth >= 2 = inside loop

    // Parse Variables section
    if (line.startsWith("$")) {
      const match = line.match(/^\$(\w+)=(.+)$/);
      if (match) {
        variables[match[1]] = match[2];
      }
      continue;
    }

    // Parse Sample (audio)
    if (line.startsWith("Sample,")) {
      const parts = line.replace(/^"/, "").replace(/"$/g, "").split(",");
      if (parts.length >= 4) {
        samples.push({
          id: `sample_${samples.length}`,
          time: parseInt(parts[1]) || 0,
          layer: parseLayer(parts[2]),
          path: substituteVariables(parts[3].replace(/^"|"$/g, "").replace(/\\/g, "/"), variables),
          volume: parseInt(parts[4]) || 100,
        });
        const sampleTime = parseInt(parts[1]) || 0;
        if (sampleTime > maxTime) maxTime = sampleTime + 5000; // Add 5s buffer for audio
      }
      continue;
    }

    // Parse Sprite
    if (line.startsWith("Sprite,")) {
      // Save previous object
      if (currentObject) {
        // Flush any pending loop to loops array before saving
        if (currentLoop && currentLoop.childCommands.length > 0) {
          // Calculate loop duration from the span of command times
          currentLoop.loopDuration = calculateLoopDuration(currentLoop.childCommands);
          // repeatCount preserved from L command (osu! behavior: repeatCount + 1 total iterations)
          // Keep command times as-is (relative to loop start)
          // Runtime will calculate absolute times based on iteration
          currentObject.loops.push({
            startTime: currentLoop.startTime,
            repeatCount: currentLoop.repeatCount,
            commands: currentLoop.childCommands,
            loopDuration: currentLoop.loopDuration,
          });
          currentLoop = null;
        }
        if (currentTrigger && currentTrigger.childCommands.length > 0) {
          currentObject.commands.push(...currentTrigger.childCommands);
          currentTrigger = null;
        }
        objects.push(currentObject);
      }

      const parts = line.split(",");
      if (parts.length >= 5) {
        currentObject = {
          id: `sprite_${objects.length}`,
          type: "sprite",
          layer: parseLayer(parts[1]),
          origin: parseOrigin(parts[2]),
          path: substituteVariables(parts[3].replace(/^"|"$/g, "").replace(/\\/g, "/"), variables),
          x: clampCoord(parseInt(parts[4]) || 0),
          y: clampCoord(parseInt(parts[5]) || 0),
          commands: [],
          loops: [],
        };
      }
      continue;
    }

    // Parse Animation
    if (line.startsWith("Animation,")) {
      // Save previous object
      if (currentObject) {
        // Flush any pending loop to loops array before saving
        if (currentLoop && currentLoop.childCommands.length > 0) {
          // Calculate loop duration from the span of command times
          currentLoop.loopDuration = calculateLoopDuration(currentLoop.childCommands);
          // repeatCount preserved from L command (osu! behavior: repeatCount + 1 total iterations)
          // Keep command times as-is (relative to loop start)
          // Runtime will calculate absolute times based on iteration
          currentObject.loops.push({
            startTime: currentLoop.startTime,
            repeatCount: currentLoop.repeatCount,
            commands: currentLoop.childCommands,
            loopDuration: currentLoop.loopDuration,
          });
          currentLoop = null;
        }
        if (currentTrigger && currentTrigger.childCommands.length > 0) {
          currentObject.commands.push(...currentTrigger.childCommands);
          currentTrigger = null;
        }
        objects.push(currentObject);
      }

      const parts = line.split(",");
      if (parts.length >= 8) {
        currentObject = {
          id: `anim_${objects.length}`,
          type: "animation",
          layer: parseLayer(parts[1]),
          origin: parseOrigin(parts[2]),
          path: substituteVariables(parts[3].replace(/^"|"$/g, "").replace(/\\/g, "/"), variables),
          x: clampCoord(parseInt(parts[4]) || 0),
          y: clampCoord(parseInt(parts[5]) || 0),
          frameCount: parseInt(parts[6]) || 1,
          frameDelay: parseInt(parts[7]) || 100,
          loopType: (() => {
            const val = parts[8];
            const isValid = val && VALID_LOOP_TYPES.includes(val as "LoopForever" | "LoopOnce");
            if (val && !isValid) {
              console.warn(`[sbParser] Invalid animation loopType "${val}", defaulting to "LoopForever"`);
            }
            return (isValid ? val : "LoopForever") as "LoopForever" | "LoopOnce";
          })(),
          commands: [],
          loops: [],
        };
      }
      continue;
    }

    // Parse Video
    if (line.startsWith("Video,")) {
      // Save previous object
      if (currentObject) {
        if (currentLoop && currentLoop.childCommands.length > 0) {
          currentLoop.loopDuration = calculateLoopDuration(currentLoop.childCommands);
          currentObject.loops.push({
            startTime: currentLoop.startTime,
            repeatCount: currentLoop.repeatCount,
            commands: currentLoop.childCommands,
            loopDuration: currentLoop.loopDuration,
          });
          currentLoop = null;
        }
        if (currentTrigger && currentTrigger.childCommands.length > 0) {
          currentObject.commands.push(...currentTrigger.childCommands);
          currentTrigger = null;
        }
        objects.push(currentObject);
      }

      const parts = line.split(",");
      const path = parts[2]?.replace(/^"/, "").replace(/"$/, "") || "";
      const ext = path.split(".").pop()?.toLowerCase() || "";
      if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "mp4", "webm"].includes(ext)) {
        currentObject = {
          id: path,
          type: "video",
          layer: "Background",
          origin: "TopLeft",
          path,
          x: 0,
          y: 0,
          commands: [],
          loops: [],
        };
      }
      continue;
    }

    // Parse L (Loop) command
    if (currentObject && (line.startsWith("L,") || line.startsWith("_L,"))) {
      // Save previous loop to loops array (don't expand)
      if (currentLoop && currentLoop.childCommands.length > 0) {
        // Calculate loop duration from the span of command times
        currentLoop.loopDuration = calculateLoopDuration(currentLoop.childCommands);

        // Detect absolute-time loops and fix repeat count
        // repeatCount preserved from L command
        // Save to loops array instead of expanding
        currentObject.loops.push({
          startTime: currentLoop.startTime,
          repeatCount: currentLoop.repeatCount,
          commands: currentLoop.childCommands,
          loopDuration: currentLoop.loopDuration,
        });
        currentLoop = null;
      }

      const parts = line.replace(/^_/, "").split(",");
      const loopStart = parseInt(parts[1]) || 0;
      // osu! behavior: L command repeatCount means "total plays - 1"
      // e.g., L,1000,3 means 3 total iterations (stored as repeatCount=2, TotalIterations=repeatCount+1=3)
      const repeatCount = Math.max(0, parseInt(parts[2]) - 1);
      currentLoop = {
        startTime: loopStart,
        repeatCount: repeatCount,
        childCommands: [],
        loopDuration: 0,
      };
      continue;
    }

    // Parse T (Trigger) command
    if (currentObject && (line.startsWith("T,") || line.startsWith("_T,"))) {
      // Flush previous trigger if any
      if (currentTrigger && currentTrigger.childCommands.length > 0) {
        currentObject.commands.push(...currentTrigger.childCommands);
        currentTrigger = null;
      }

      const parts = line.replace(/^_/, "").split(",");
      const triggerName = parts[1] || "Passing";
      const triggerStart = parseInt(parts[2]) || 0;
      const triggerEnd = parts[3] ? parseInt(parts[3]) : 999999999;
      currentTrigger = {
        name: triggerName,
        startTime: triggerStart,
        endTime: triggerEnd,
        childCommands: [],
        groupNumber: parts[4] ? parseInt(parts[4]) : undefined,
      };
      continue;
    }

    // Parse child commands inside loop/trigger (with __ prefix OR depth >= 2)
    // osu! uses leading spaces for indentation, but some tools use underscores
    const isChildCommand = depth >= 2 && (line.startsWith("F") || line.startsWith("M") ||
      line.startsWith("S") || line.startsWith("V") || line.startsWith("R") ||
      line.startsWith("C"));

    if (currentObject && isChildCommand) {
      const cmds = parseCommand(line, variables);
      if (cmds) {
        for (const cmd of cmds) {
          if (currentLoop) {
            currentLoop.childCommands.push(cmd);
          } else if (currentTrigger) {
            // For triggers, adjust time relative to trigger start
            currentTrigger.childCommands.push({
              ...cmd,
              startTime: currentTrigger.startTime + cmd.startTime,
              endTime: currentTrigger.startTime + cmd.endTime,
            });
          } else {
            currentObject.commands.push(cmd);
            if (cmd.endTime > maxTime) {
              maxTime = cmd.endTime;
            }
          }
        }
      }
      continue;
    }

    // Also handle __ prefixed commands (legacy format)
    if (currentObject && (line.startsWith("__F") || line.startsWith("__M") ||
      line.startsWith("__S") || line.startsWith("__V") || line.startsWith("__R") ||
      line.startsWith("__C") || line.startsWith("__MX") ||
      line.startsWith("__MY"))) {
      const childLine = line.replace(/^__/, "_");
      const cmds = parseCommand(childLine, variables);
      if (cmds) {
        for (const cmd of cmds) {
          if (currentLoop) {
            currentLoop.childCommands.push(cmd);
          } else if (currentTrigger) {
            // For triggers, adjust time relative to trigger start
            currentTrigger.childCommands.push({
              ...cmd,
              startTime: currentTrigger.startTime + cmd.startTime,
              endTime: currentTrigger.startTime + cmd.endTime,
            });
          } else {
            currentObject.commands.push(cmd);
            if (cmd.endTime > maxTime) {
              maxTime = cmd.endTime;
            }
          }
        }
      }
      continue;
    }


    // Parse P (Parameter) command for current object
    if (currentObject && (line.startsWith("P,") || line.startsWith("_P,") || line.startsWith("__P,"))) {
      const parts = line.replace(/^_+/, "").split(",");
      const param = parts[4]?.trim();
      const startTime = parseInt(parts[2]) || 0;
      const endTime = parseInt(parts[3]) || startTime;
      const isPermanent = startTime === endTime;

      if (isPermanent) {
        // Permanent P command: set static boolean (backward compatible)
        if (param === "H") currentObject.flipH = true;
        else if (param === "V") currentObject.flipV = true;
        else if (param === "A") currentObject.additive = true;
      } else {
        // Temporary P command: create command object, add to commands[]
        const cmd: SbCommand = {
          type: "P",
          easing: 0,
          startTime,
          endTime,
          params: [],
          paramStrings: [param],
        };
        if (currentLoop && depth >= 2) {
          currentLoop.childCommands.push(cmd);
        } else if (currentTrigger) {
          currentTrigger.childCommands.push({
            ...cmd,
            startTime: currentTrigger.startTime + cmd.startTime,
            endTime: currentTrigger.startTime + cmd.endTime,
          });
        } else {
          currentObject.commands.push(cmd);
          if (endTime > maxTime) {
            maxTime = endTime;
          }
        }
      }
      continue;
    }

    // Parse regular Commands for current object
    if (currentObject && (line.match(/^[FMCPSRV]/) || line.match(/^_[FMCPSRV]/))) {
      const cmds = parseCommand(line, variables);
      if (cmds) {
        // Only add to loop if line has loop-level indentation (3+ spaces)
        // This distinguishes commands inside L blocks from regular commands
        for (const cmd of cmds) {
          if (currentLoop && depth >= 2) {
            currentLoop.childCommands.push(cmd);
          } else {
            currentObject.commands.push(cmd);
            if (cmd.endTime > maxTime) {
              maxTime = cmd.endTime;
            }
          }
        }
      }
    }
  }

  // Push last object
  if (currentObject) {
    // Flush any pending loop to loops array before saving
    if (currentLoop && currentLoop.childCommands.length > 0) {
      // Calculate loop duration from the span of command times
      currentLoop.loopDuration = calculateLoopDuration(currentLoop.childCommands);
      // Detect absolute-time loops and fix repeat count
      // repeatCount preserved from L command
      // Save to loops array instead of expanding
      currentObject.loops.push({
        startTime: currentLoop.startTime,
        repeatCount: currentLoop.repeatCount,
        commands: currentLoop.childCommands,
        loopDuration: currentLoop.loopDuration,
      });
      // Calculate max time from loop iterations
      const loopEndTime = currentLoop.startTime + (currentLoop.repeatCount + 1) * currentLoop.loopDuration;
      if (loopEndTime > maxTime) {
        maxTime = loopEndTime;
      }
      currentLoop = null;
    }
    if (currentTrigger && currentTrigger.childCommands.length > 0) {
      currentObject.commands.push(...currentTrigger.childCommands);
      for (const cmd of currentTrigger.childCommands) {
        if (cmd.endTime > maxTime) {
          maxTime = cmd.endTime;
        }
      }
      currentTrigger = null;
    }
    objects.push(currentObject);
  }

  return {
    objects,
    samples,
    variables,
    duration: maxTime + 1000, // Add 1 second buffer
  };
}

export function parseStoryboardFile(filePath: string): ParsedStoryboard | null {
  if (!fs.existsSync(filePath)) {
    console.error(`Storyboard file not found: ${filePath}`);
    return null;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  return parseStoryboard(content);
}

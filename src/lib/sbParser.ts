import * as fs from "fs";

// ============================================
// Types
// ============================================

export type Layer = "Background" | "Fail" | "Pass" | "Foreground";
export type Origin =
  | "TopLeft" | "Centre" | "CentreLeft" | "TopRight"
  | "BottomCentre" | "TopCentre" | "CentreRight"
  | "BottomLeft" | "BottomRight";

export type CommandType = "F" | "M" | "MX" | "MY" | "S" | "V" | "R" | "C" | "P";

// Easing function mapping (0-34)
export const EASING_NAMES: Record<number, string> = {
  0: "linear",
  1: "easeOut",
  2: "easeIn",
  3: "easeInQuad",
  4: "easeOutQuad",
  5: "easeInOutQuad",
  6: "easeInCubic",
  7: "easeOutCubic",
  8: "easeInOutCubic",
  9: "easeInQuart",
  10: "easeOutQuart",
  11: "easeInOutQuart",
  12: "easeInQuint",
  13: "easeOutQuint",
  14: "easeInOutQuint",
  15: "easeInSine",
  16: "easeOutSine",
  17: "easeInOutSine",
  18: "easeInExpo",
  19: "easeOutExpo",
  20: "easeInOutExpo",
  21: "easeInCirc",
  22: "easeOutCirc",
  23: "easeInOutCirc",
  24: "easeInElastic",
  25: "easeOutElastic",
  26: "easeOutElasticHalf",
  27: "easeOutElasticQuarter",
  28: "easeInOutElastic",
  29: "easeInBack",
  30: "easeOutBack",
  31: "easeInOutBack",
  32: "easeInBounce",
  33: "easeOutBounce",
  34: "easeInOutBounce",
};

export interface SbCommand {
  type: CommandType;
  easing: number;
  startTime: number;
  endTime: number;
  params: number[];
}

export interface SbObject {
  id: string;
  type: "sprite" | "animation";
  layer: Layer;
  origin: Origin;
  path: string;
  x: number;
  y: number;
  frameCount?: number;
  frameDelay?: number;
  loopType?: "LoopForever" | "LoopOnce";
  commands: SbCommand[];
  // P command parameters
  flipH?: boolean;
  flipV?: boolean;
  additive?: boolean;
}

export interface ParsedStoryboard {
  objects: SbObject[];
  variables: Record<string, string>;
  duration: number;
}

// ============================================
// Parsing Helpers
// ============================================

function parseLayer(value: string | number): Layer {
  const layers: Record<number, Layer> = {
    0: "Background",
    1: "Fail",
    2: "Pass",
    3: "Foreground",
  };
  if (typeof value === "number") {
    return layers[value] || "Background";
  }
  return (layers[parseInt(value)] as Layer) || "Background";
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
  if (typeof value === "number") {
    return origins[value] || "Centre";
  }
  return (origins[parseInt(value)] as Origin) || "Centre";
}

function parseCommand(line: string): SbCommand | null {
  // Remove leading underscore if present
  const cleanLine = line.replace(/^_/, "");
  const parts = cleanLine.split(",");

  if (parts.length < 3) return null;

  const type = parts[0].trim() as CommandType;
  const easing = parseInt(parts[1]) || 0;
  const startTime = parseInt(parts[2]) || 0;

  // Determine end time and params based on command type
  let endTime = startTime;
  let params: number[] = [];

  switch (type) {
    case "F": // Fade: type,easing,start,end,startVal,endVal
      endTime = parseInt(parts[3]) || startTime;
      params = [
        parseFloat(parts[4]) || 0,
        (parseFloat(parts[5]) ?? parseFloat(parts[4])) || 0,
      ];
      break;
    case "M": // Move: type,easing,start,end,x1,y1,x2,y2
      endTime = parseInt(parts[3]) || startTime;
      params = [
        parseFloat(parts[4]) || 0,
        parseFloat(parts[5]) || 0,
        (parseFloat(parts[6]) ?? parseFloat(parts[4])) || 0,
        (parseFloat(parts[7]) ?? parseFloat(parts[5])) || 0,
      ];
      break;
    case "MX": // MoveX: type,easing,start,end,x1,x2
      endTime = parseInt(parts[3]) || startTime;
      params = [
        parseFloat(parts[4]) || 0,
        (parseFloat(parts[5]) ?? parseFloat(parts[4])) || 0,
      ];
      break;
    case "MY": // MoveY: type,easing,start,end,y1,y2
      endTime = parseInt(parts[3]) || startTime;
      params = [
        parseFloat(parts[4]) || 0,
        (parseFloat(parts[5]) ?? parseFloat(parts[4])) || 0,
      ];
      break;
    case "S": // Scale: type,easing,start,end,startScale,endScale
      endTime = parseInt(parts[3]) || startTime;
      params = [
        parseFloat(parts[4]) || 1,
        (parseFloat(parts[5]) ?? parseFloat(parts[4])) || 1,
      ];
      break;
    case "V": // Vector Scale: type,easing,start,end,sx1,sy1,sx2,sy2
      endTime = parseInt(parts[3]) || startTime;
      params = [
        parseFloat(parts[4]) || 1,
        parseFloat(parts[5]) || 1,
        (parseFloat(parts[6]) ?? parseFloat(parts[4])) || 1,
        (parseFloat(parts[7]) ?? parseFloat(parts[5])) || 1,
      ];
      break;
    case "R": // Rotate: type,easing,start,end,startRad,endRad
      endTime = parseInt(parts[3]) || startTime;
      params = [
        parseFloat(parts[4]) || 0,
        (parseFloat(parts[5]) ?? parseFloat(parts[4])) || 0,
      ];
      break;
    case "C": // Color: type,easing,start,end,r1,g1,b1,r2,g2,b2
      endTime = parseInt(parts[3]) || startTime;
      params = [
        parseFloat(parts[4]) || 255,
        parseFloat(parts[5]) || 255,
        parseFloat(parts[6]) || 255,
        (parseFloat(parts[7]) ?? parseFloat(parts[4])) || 255,
        (parseFloat(parts[8]) ?? parseFloat(parts[5])) || 255,
        (parseFloat(parts[9]) ?? parseFloat(parts[6])) || 255,
      ];
      break;
    case "P": // Parameter: type,easing,start,end,param
      // P command is handled in the main loop, not here
      return null;
    default:
      return null;
  }

  return {
    type,
    easing,
    startTime,
    endTime,
    params,
  };
}

// ============================================
// Main Parser
// ============================================

export function parseStoryboard(content: string): ParsedStoryboard {
  const lines = content.split("\n");
  const objects: SbObject[] = [];
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
  }
  let currentTrigger: TriggerContext | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines and comments
    if (!line || line.startsWith("//")) continue;

    // Parse Variables section
    if (line.startsWith("$")) {
      const match = line.match(/^\$(\w+)=(.+)$/);
      if (match) {
        variables[match[1]] = match[2];
      }
      continue;
    }

    // Parse Sprite
    if (line.startsWith("Sprite,")) {
      // Save previous object
      if (currentObject) {
        // Flush any pending loop/trigger commands before saving
        if (currentLoop && currentLoop.childCommands.length > 0) {
          currentObject.commands.push(...currentLoop.childCommands);
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
          path: parts[3].replace(/^"|"$/g, "").replace(/\\/g, "/"),
          x: parseInt(parts[4]) || 0,
          y: parseInt(parts[5]) || 0,
          commands: [],
        };
      }
      continue;
    }

    // Parse Animation
    if (line.startsWith("Animation,")) {
      // Save previous object
      if (currentObject) {
        // Flush any pending loop/trigger commands before saving
        if (currentLoop && currentLoop.childCommands.length > 0) {
          currentObject.commands.push(...currentLoop.childCommands);
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
          path: parts[3].replace(/^"|"$/g, "").replace(/\\/g, "/"),
          x: parseInt(parts[4]) || 0,
          y: parseInt(parts[5]) || 0,
          frameCount: parseInt(parts[6]) || 1,
          frameDelay: parseInt(parts[7]) || 100,
          loopType: (parts[8] as "LoopForever" | "LoopOnce") || "LoopForever",
          commands: [],
        };
      }
      continue;
    }

    // Parse L (Loop) command
    if (currentObject && (line.startsWith("L,") || line.startsWith("_L,"))) {
      // Flush previous loop if any
      if (currentLoop && currentLoop.childCommands.length > 0) {
        // Calculate loop duration from the last command
        const lastCmd = currentLoop.childCommands[currentLoop.childCommands.length - 1];
        currentLoop.loopDuration = lastCmd.endTime - lastCmd.startTime;
        // Expand the loop commands
        for (let iter = 0; iter < currentLoop.repeatCount; iter++) {
          for (const cmd of currentLoop.childCommands) {
            currentObject.commands.push({
              ...cmd,
              startTime: currentLoop.startTime + iter * currentLoop.loopDuration + (cmd.startTime % currentLoop.loopDuration),
              endTime: currentLoop.startTime + iter * currentLoop.loopDuration + (cmd.endTime % currentLoop.loopDuration),
            });
          }
        }
        currentLoop = null;
      }

      const parts = line.replace(/^_/, "").split(",");
      const loopStart = parseInt(parts[1]) || 0;
      const repeatCount = parseInt(parts[2]) || 1;
      currentLoop = {
        startTime: loopStart,
        repeatCount: Math.max(0, repeatCount - 1), // osu! uses repeat count, we need iterations
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
      };
      continue;
    }

    // Parse child commands (with __ prefix) inside loop/trigger
    if (currentObject && (line.startsWith("__F") || line.startsWith("__M") ||
        line.startsWith("__S") || line.startsWith("__V") || line.startsWith("__R") ||
        line.startsWith("__C") || line.startsWith("__P") || line.startsWith("__MX") ||
        line.startsWith("__MY"))) {
      const childLine = line.replace(/^__/, "_");
      const cmd = parseCommand(childLine);
      if (cmd) {
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
      continue;
    }

    // Parse P (Parameter) command for current object
    if (currentObject && (line.startsWith("P,") || line.startsWith("_P,"))) {
      const parts = line.replace(/^_/, "").split(",");
      const param = parts[4]?.trim();
      const startTime = parseInt(parts[2]) || 0;
      const endTime = parseInt(parts[3]) || startTime;
      const isPermanent = startTime === endTime;

      if (param === "H" && isPermanent) {
        currentObject.flipH = true;
      } else if (param === "V" && isPermanent) {
        currentObject.flipV = true;
      } else if (param === "A" && isPermanent) {
        currentObject.additive = true;
      }
      continue;
    }

    // Parse regular Commands for current object
    if (currentObject && line.match(/^[FMCPSR]/) || line.match(/^_[FMCPSR]/)) {
      const cmd = parseCommand(line);
      if (cmd) {
        currentObject.commands.push(cmd);
        if (cmd.endTime > maxTime) {
          maxTime = cmd.endTime;
        }
      }
    }
  }

  // Push last object
  if (currentObject) {
    // Flush any pending loop/trigger commands before saving
    if (currentLoop && currentLoop.childCommands.length > 0) {
      const lastCmd = currentLoop.childCommands[currentLoop.childCommands.length - 1];
      currentLoop.loopDuration = lastCmd.endTime - lastCmd.startTime;
      // Expand the loop commands
      for (let iter = 0; iter <= currentLoop.repeatCount; iter++) {
        for (const cmd of currentLoop.childCommands) {
          const adjustedStart = currentLoop.startTime + iter * currentLoop.loopDuration + (cmd.startTime % currentLoop.loopDuration);
          const adjustedEnd = currentLoop.startTime + iter * currentLoop.loopDuration + (cmd.endTime % currentLoop.loopDuration);
          currentObject.commands.push({
            ...cmd,
            startTime: adjustedStart,
            endTime: adjustedEnd,
          });
          if (adjustedEnd > maxTime) {
            maxTime = adjustedEnd;
          }
        }
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

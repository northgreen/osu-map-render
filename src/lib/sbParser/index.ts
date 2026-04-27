// Barrel export - re-exports everything from sbParser for backward compatibility
//
// Browser-safe types: import from "sbParser/types" to avoid Node.js fs dependency
// Full parser (Node.js): import from "sbParser" or "sbParser/parser"

export {
  parseStoryboard,
  parseStoryboardFile,
  INFINITE_DURATION,
  EASING_NAMES,
} from "./parser";

export type {
  Layer,
  Origin,
  CommandType,
  SbCommand,
  SbLoop,
  SbObject,
  SbSample,
  ParsedStoryboard,
} from "./types";

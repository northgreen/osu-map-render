import hitsoundFiles from "../generated/hitsound-files.json";

/**
 * Set of available hitsound filenames in public/.
 * Generated at parse time by scripts/parseBeatmap.ts.
 */
export const availableHitsoundFiles: ReadonlySet<string> = new Set(hitsoundFiles);

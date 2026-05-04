import { execSync } from "child_process";

/**
 * Get the duration of an audio file in milliseconds using ffprobe.
 * Returns null if ffprobe is unavailable or the file can't be probed.
 */
export function getAudioDurationInMs(filePath: string): number | null {
  try {
    const result = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { timeout: 5000, encoding: "utf-8" },
    );
    const durationSec = parseFloat(result.trim());
    if (isNaN(durationSec)) return null;
    return Math.ceil(durationSec * 1000); // convert to ms, round up
  } catch {
    return null;
  }
}

import * as fs from "fs";
import * as path from "path";
import { parseStoryboard } from "../src/lib/sbParser";
import { getAudioDurationInMs } from "./audioUtils";

const storyboardPath = "public/storyboard.osb";
const outputPath = "src/generated/storyboard.json";

if (!fs.existsSync(storyboardPath)) {
  console.error("Storyboard file not found:", storyboardPath);
  process.exit(1);
}

console.log("Parsing storyboard:", storyboardPath);
const content = fs.readFileSync(storyboardPath, "utf-8");
const storyboard = parseStoryboard(content);

console.log("Parsed objects:", storyboard.objects.length);
console.log("Parsed samples:", storyboard.samples.length);
console.log("Duration:", storyboard.duration, "ms");

// Probe audio duration for storyboard samples via ffprobe
if (storyboard.samples.length) {
  const publicDir = path.resolve("public");
  for (const sample of storyboard.samples) {
    const samplePath = path.join(publicDir, sample.path);
    if (fs.existsSync(samplePath)) {
      const duration = getAudioDurationInMs(samplePath);
      if (duration !== null) {
        sample.duration = duration;
      }
    }
  }
}

fs.writeFileSync(outputPath, JSON.stringify(storyboard, null, 2));
console.log("Saved to:", outputPath);

import * as fs from "fs";
import { parseStoryboard } from "../src/lib/sbParser";

const storyboardPath = "public/storyboard.osb";
const outputPath = "src/lib/storyboard.json";

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

fs.writeFileSync(outputPath, JSON.stringify(storyboard, null, 2));
console.log("Saved to:", outputPath);

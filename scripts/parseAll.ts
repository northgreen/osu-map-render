import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const GENERATED_DIR = path.join(process.cwd(), "src", "generated");
const STORYBOARD_JSON = path.join(GENERATED_DIR, "storyboard.json");

const DEFAULT_STORYBOARD = {
  objects: [],
  samples: [],
  variables: {},
  duration: 0,
};

function runCommand(command: string, label: string): void {
  console.log(`\n=== ${label} ===`);
  execSync(command, { stdio: "inherit" });
}

function writeDefaultStoryboard(): void {
  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  }

  fs.writeFileSync(
    STORYBOARD_JSON,
    JSON.stringify(DEFAULT_STORYBOARD, null, 2),
  );
  console.log(`Wrote default empty storyboard to ${STORYBOARD_JSON}`);
}

function main(): void {
  runCommand("tsx scripts/parseBeatmap.ts", "Parsing beatmap");

  try {
    runCommand("tsx scripts/parseReplay.ts", "Parsing replay");
  } catch {
    console.log("\nNo replay found or replay parsing failed (optional, continuing)");
  }

  if (!fs.existsSync(STORYBOARD_JSON)) {
    writeDefaultStoryboard();
  } else {
    console.log(`\nStoryboard already exists at ${STORYBOARD_JSON}`);
  }

  console.log("\n=== Parse complete ===");
}

main();

import * as fs from "fs";
import * as path from "path";
import readline from "readline";

const CHEART_DIR = path.join(process.cwd(), "cheart");
const REPLAY_DIR = path.join(process.cwd(), "replay");

export function listFiles(dir: string, pattern: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir).filter((f) => f.endsWith(pattern));
}

export async function selectFile(
  promptText: string,
  files: string[]
): Promise<string | null> {
  if (files.length === 0) {
    return null;
  }
  if (files.length === 1) {
    return files[0];
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`\n${promptText}`);
  files.forEach((file, index) => {
    console.log(`  ${index + 1}. ${file}`);
  });
  console.log(`  0. Cancel (use default)`);

  return new Promise((resolve) => {
    rl.question("\nSelect file (number): ", (answer) => {
      rl.close();
      const num = parseInt(answer);
      if (isNaN(num) || num < 0 || num > files.length) {
        console.log("Invalid selection, using default.");
        resolve(null);
      } else if (num === 0) {
        resolve(null);
      } else {
        resolve(files[num - 1]);
      }
    });
  });
}

export function matchFile(searchTerm: string, files: string[]): string | null {
  // Exact match first
  const exact = files.find((f) => f === searchTerm);
  if (exact) return exact;

  // Partial match (case-insensitive)
  const partial = files.filter((f) =>
    f.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (partial.length === 1) {
    return partial[0];
  }

  // If multiple matches, return null to let user choose
  if (partial.length > 1) {
    console.log(`Multiple matches for "${searchTerm}":`);
    partial.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  } else {
    console.log(`No match found for "${searchTerm}"`);
  }

  return null;
}

export function getCheartDir(): string {
  return CHEART_DIR;
}

export function getReplayDir(): string {
  return REPLAY_DIR;
}

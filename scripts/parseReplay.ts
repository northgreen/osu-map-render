import * as fs from "fs";
import * as path from "path";
import { parseOsuReplay } from "../src/lib/osrParser";
import {
  listFiles,
  selectFile,
  matchFile,
  getCheartDir,
  getReplayDir,
} from "./selectFile";
import type { ParsedBeatmap } from "../src/lib/osuParser";
import beatmapData from "../src/generated/beatmap.json";

function writeEmptyReplay() {
  const emptyReplay = {
    mode: 3,
    gameVersion: 0,
    beatmapHash: "",
    playerName: "",
    replayHash: "",
    count300: 0,
    count100: 0,
    count50: 0,
    countGeki: 0,
    countKatu: 0,
    countMiss: 0,
    totalScore: 0,
    maxCombo: 0,
    perfect: false,
    mods: 0,
    lifeData: [],
    timestamp: 0,
    replayData: [],
    onlineScoreId: 0,
  };

  fs.writeFileSync(
    path.join(process.cwd(), "src", "generated", "replay.json"),
    JSON.stringify(emptyReplay, null, 2),
  );
  console.log("No replay file found. Generated empty replay.json (Autoplay mode).");
}

async function main() {
  const args = process.argv.slice(2);
  const searchTerm = args[0];
  const replayDir = getReplayDir();
  const cheartDir = getCheartDir();
  const osrFiles = listFiles(replayDir, ".osr");
  const cheartOsrFiles = listFiles(cheartDir, ".osr");
  const rootOsrFiles = listFiles(process.cwd(), ".osr");

  // Combine all sources: replay/ > cheart/ > root
  const allOsrFiles = [
    ...osrFiles,
    ...cheartOsrFiles.filter((f) => !osrFiles.includes(f)),
    ...rootOsrFiles.filter(
      (f) => !osrFiles.includes(f) && !cheartOsrFiles.includes(f),
    ),
  ];

  let selectedFile: string | null = null;
  let replayPath: string | null = null;

  if (allOsrFiles.length === 0 && !searchTerm) {
    // No .osr files found - generate empty replay for autoplay mode
    writeEmptyReplay();
    return;
  } else if (searchTerm) {
    // Try to match the search term
    selectedFile = matchFile(searchTerm, allOsrFiles);
    if (!selectedFile && allOsrFiles.length > 0) {
      selectedFile = await selectFile("Available replays:", allOsrFiles);
    } else if (!selectedFile && allOsrFiles.length === 0) {
      console.log("No .osr files found. Generating empty replay.json (Autoplay mode).");
      writeEmptyReplay();
      return;
    }
  } else if (allOsrFiles.length > 0) {
    // No argument - show menu
    selectedFile = await selectFile("Select a replay:", allOsrFiles);
  }

  if (selectedFile) {
    // Check which folder the file is in
    if (osrFiles.includes(selectedFile)) {
      replayPath = path.join(replayDir, selectedFile);
    } else if (cheartOsrFiles.includes(selectedFile)) {
      replayPath = path.join(cheartDir, selectedFile);
    } else {
      replayPath = path.join(process.cwd(), selectedFile);
    }
  } else if (!replayPath) {
    // User cancelled selection - generate empty replay
    writeEmptyReplay();
    return;
  }

  console.log(`\nLooking for file: ${path.basename(replayPath)}`);

  if (!fs.existsSync(replayPath)) {
    console.error(`Error: Replay file not found: ${replayPath}`);
    console.log("Place your .osr file in the replay/ folder.");
    console.log("Generating empty replay.json (Autoplay mode) instead.");
    writeEmptyReplay();
    return;
  }

  let replay;
  try {
    replay = parseOsuReplay(replayPath);
  } catch (error) {
    console.error(
      `Error parsing replay: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }

  if (replay) {
    const replayForJson: Record<string, unknown> = { ...replay };
    replayForJson.timestamp = Number(replay.timestamp);
    replayForJson.onlineScoreId = Number(replay.onlineScoreId);

    const typedBeatmap = beatmapData as ParsedBeatmap;
    if (replay.beatmapHash && typedBeatmap.fileHash) {
      if (replay.beatmapHash !== typedBeatmap.fileHash) {
        console.warn(
          `WARNING: Replay beatmap hash (${replay.beatmapHash}) does not match current beatmap hash (${typedBeatmap.fileHash})`,
        );
        console.warn("The replay may be for a different beatmap version.");
      } else {
        console.log("Replay beatmap hash matches current beatmap.");
      }
    }

    fs.writeFileSync(
      path.join(process.cwd(), "src", "generated", "replay.json"),
      JSON.stringify(replayForJson, null, 2),
    );

    console.log("Replay parsed and saved to src/generated/replay.json");
    console.log(`Player: ${replay.playerName}`);
    console.log(`Mode: ${replay.mode} (0=std, 1=taiko, 2=catch, 3=mania)`);
    console.log(`Mods: ${replay.mods}`);
    console.log(`Score: ${replay.totalScore}`);
    console.log(`Max Combo: ${replay.maxCombo}`);
    console.log(
      `300: ${replay.count300}, 100: ${replay.count100}, 50: ${replay.count50}, Miss: ${replay.countMiss}`,
    );
    console.log(`Perfect: ${replay.perfect}`);
    console.log(`Replay frames: ${replay.replayData.length}`);

    // Show sample frames with keys
    console.log("\nSample frames with keys:");
    let t = 0;
    let count = 0;
    for (let i = 0; i < replay.replayData.length && count < 20; i++) {
      t += replay.replayData[i].timeOffset;
      if (replay.replayData[i].keys > 0 || replay.replayData[i].x > 0) {
        console.log(
          `frame ${i}: time=${t} x=${replay.replayData[i].x} y=${replay.replayData[i].y} keys=${replay.replayData[i].keys}`,
        );
        count++;
      }
    }
  }
}

main();

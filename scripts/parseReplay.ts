import * as fs from "fs";
import * as path from "path";
import { parseOsuReplay } from "../src/lib/osrParser";

const replayPath = path.join(
  process.cwd(),
  "solo-replay-mania_5205935_6395917723.osr"
);

console.log("Looking for file:", replayPath);
console.log("File exists:", fs.existsSync(replayPath));

if (fs.existsSync(replayPath)) {
  const replay = parseOsuReplay(replayPath);

  if (replay) {
    // Convert BigInt to Number for JSON serialization
    const replayForJson: Record<string, unknown> = { ...replay };
    replayForJson.timestamp = Number(replay.timestamp);
    replayForJson.onlineScoreId = Number(replay.onlineScoreId);

    // Write the parsed replay to a JSON file for import
    fs.writeFileSync(
      path.join(process.cwd(), "src", "lib", "replay.json"),
      JSON.stringify(replayForJson, null, 2)
    );

    console.log("Replay parsed and saved to src/lib/replay.json");
    console.log(`Player: ${replay.playerName}`);
    console.log(`Mode: ${replay.mode} (0=std, 1=taiko, 2=catch, 3=mania)`);
    console.log(`Mods: ${replay.mods}`);
    console.log(`Score: ${replay.totalScore}`);
    console.log(`Max Combo: ${replay.maxCombo}`);
    console.log(`300: ${replay.count300}, 100: ${replay.count100}, 50: ${replay.count50}, Miss: ${replay.countMiss}`);
    console.log(`Perfect: ${replay.perfect}`);
    console.log(`Replay frames: ${replay.replayData.length}`);

    // Show sample frames with keys
    console.log("\nSample frames with keys:");
    let t = 0;
    let count = 0;
    for (let i = 0; i < replay.replayData.length && count < 20; i++) {
      t += replay.replayData[i].timeOffset;
      if (replay.replayData[i].keys > 0 || replay.replayData[i].x > 0) {
        console.log(`frame ${i}: time=${t} x=${replay.replayData[i].x} y=${replay.replayData[i].y} keys=${replay.replayData[i].keys}`);
        count++;
      }
    }
  }
} else {
  console.log("No .osr file found.");
}
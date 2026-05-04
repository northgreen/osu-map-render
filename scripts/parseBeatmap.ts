import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { listFiles, selectFile, matchFile, getCheartDir } from "./selectFile";
import { parseStoryboardFile } from "../src/lib/sbParser";
import { extractScrollVelocitySegments } from "../src/lib/scrollVelocity";
import type { ParsedBeatmap, BeatmapMetadata, BeatmapDifficulty, TimingPoint, HitObject } from "../src/lib/osuParser";
import { parseHitSample } from "../src/lib/osuParser";

function parseSection(content: string, section: string): string[] {
  const lines = content.split("\n");
  const sectionStart = lines.findIndex((l) => l.trim() === `[${section}]`);
  if (sectionStart === -1) return [];

  const sectionLines: string[] = [];
  for (let i = sectionStart + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("[") && line !== `[${section}]`) break;
    if (line && !line.startsWith("//")) {
      sectionLines.push(line);
    }
  }
  return sectionLines;
}

function parseKeyValue(line: string): [string, string] {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return ["", ""];
  const key = line.substring(0, colonIndex).trim();
  const value = line.substring(colonIndex + 1).trim();
  return [key, value];
}

function parseOsuFile(filePath: string): ParsedBeatmap {
  const content = fs.readFileSync(filePath, "utf-8");
  const rawBytes = fs.readFileSync(filePath);
  const fileHash = crypto.createHash("md5").update(rawBytes).digest("hex");

  // Parse General
  const generalLines = parseSection(content, "General");
  const general: Record<string, string> = {};
  for (const line of generalLines) {
    const [key, value] = parseKeyValue(line);
    general[key] = value;
  }

  // Parse Events for background and storyboard
  let backgroundImage: string | undefined;
  const storyboardEvents: string[] = [];

  // Also need original lines (with leading spaces) for command parsing
  const allLines = content.split("\n");
  const eventsSectionStart = allLines.findIndex((l) => l.trim() === `[Events]`);

  for (let i = eventsSectionStart + 1; i < allLines.length; i++) {
    const originalLine = allLines[i];
    const line = originalLine.trim();

    // Check if we've reached the next section
    if (line.startsWith("[") && line !== `[Events]`) break;

    // Background: 0,0,"filename",x,y
    if (line.startsWith("0,")) {
      const match = line.match(/^0,0,"([^"]+)"/);
      if (match) {
        backgroundImage = match[1];
        continue;
      }
    }
    // Storyboard events: Sprite, Animation, Sample
    if (
      line.startsWith("Sprite,") ||
      line.startsWith("Animation,") ||
      line.startsWith("Sample,") ||
      line.startsWith("Video,")
    ) {
      storyboardEvents.push(line);
      continue;
    }
    // Storyboard commands (start with spaces or tabs)
    // Use originalLine to preserve leading spaces for L/T command depth detection
    if (/^\s+[TCFMSRVPML]/.test(originalLine)) {
      storyboardEvents.push(originalLine.replace(/\r$/, ""));
      continue;
    }
  }

  // Parse Metadata
  const metadataLines = parseSection(content, "Metadata");
  const metadata: BeatmapMetadata = {
    title: "",
    titleUnicode: "",
    artist: "",
    artistUnicode: "",
    creator: "",
    version: "",
    source: "",
    tags: [],
  };
  for (const line of metadataLines) {
    const [key, value] = parseKeyValue(line);
    switch (key) {
      case "Title":
        metadata.title = value;
        break;
      case "TitleUnicode":
        metadata.titleUnicode = value;
        break;
      case "Artist":
        metadata.artist = value;
        break;
      case "ArtistUnicode":
        metadata.artistUnicode = value;
        break;
      case "Creator":
        metadata.creator = value;
        break;
      case "Version":
        metadata.version = value;
        break;
      case "Source":
        metadata.source = value;
        break;
      case "Tags":
        metadata.tags = value.split(" ");
        break;
    }
  }

  // Parse Difficulty
  const difficultyLines = parseSection(content, "Difficulty");
  const difficulty: BeatmapDifficulty = {
    hpDrainRate: 5,
    circleSize: 4,
    overallDifficulty: 5,
    approachRate: 5,
    sliderMultiplier: 1,
    sliderTickRate: 1,
  };
  for (const line of difficultyLines) {
    const [key, value] = parseKeyValue(line);
    switch (key) {
      case "HPDrainRate":
        difficulty.hpDrainRate = parseFloat(value);
        break;
      case "CircleSize":
        difficulty.circleSize = parseInt(value);
        break;
      case "OverallDifficulty":
        difficulty.overallDifficulty = parseFloat(value);
        break;
      case "ApproachRate":
        difficulty.approachRate = parseFloat(value);
        break;
      case "SliderMultiplier":
        difficulty.sliderMultiplier = parseFloat(value);
        break;
      case "SliderTickRate":
        difficulty.sliderTickRate = parseFloat(value);
        break;
    }
  }

  // Parse TimingPoints
  const timingLines = parseSection(content, "TimingPoints");
  const timingPoints: TimingPoint[] = [];
  for (const line of timingLines) {
    const parts = line.split(",");
    if (parts.length >= 2) {
      timingPoints.push({
        time: parseInt(parts[0]),
        beatLength: parseFloat(parts[1]),
        meter: parseInt(parts[2]) || 4,
        sampleSet: parseInt(parts[3]) || 0,
        sampleIndex: parseInt(parts[4]) || 0,
        volume: parseInt(parts[5]) || 0,
        uninherited: parseInt(parts[6]) === 1,
        effects: parseInt(parts[7]) || 0,
      });
    }
  }

  const scrollVelocitySegments = extractScrollVelocitySegments(timingPoints);

  // Parse HitObjects
  const hitObjectLines = parseSection(content, "HitObjects");
  const hitObjects: HitObject[] = [];

  for (const line of hitObjectLines) {
    const parts = line.split(",");
    if (parts.length >= 5) {
      const x = parseInt(parts[0]);
      const y = parseInt(parts[1]);
      const time = parseInt(parts[2]);
      const type = parseInt(parts[3]);
      const hitSound = parseInt(parts[4]);

      // osu!mania hit object format:
      // Circle: x,y,time,type,hitSound,hitSample
      // LN:     x,y,time,type,hitSound,endTime:hitSample
      const isLongNote = (type & 128) !== 0;
      let endTime: number | undefined;
      let hitSample = "";
      
      if (isLongNote) {
        // parts[5] = "endTime:normalSet:additionSet:index:volume:filename"
        const lnParams = parts[5] || "";
        const lnParts = lnParams.split(":");
        endTime = parseInt(lnParts[0]) || undefined;
        hitSample = lnParts.slice(1).join(":");
      } else {
        // parts[5] = "normalSet:additionSet:index:volume:filename" (hitSample)
        hitSample = parts[5] || "";
      }

      // Calculate column based on x position
      // Use 512 (osu! playfield width) / circleSize (key count) for column width
      const keyCount = Math.max(1, difficulty.circleSize);
      const columnWidth = 512 / keyCount;
      const column = Math.min(Math.floor(x / columnWidth), keyCount - 1);

      hitObjects.push({
        x,
        y,
        time,
        type,
        hitSound,
        hitSample,
        parsedHitSample: parseHitSample(hitSample),
        column,
        endTime,
        isLongNote,
      });
    }
  }

  hitObjects.sort((a, b) => a.time - b.time);

  const mode = parseInt(general["Mode"]) || 0;
  if (mode !== 3) {
    console.error(
      `Error: Beatmap mode is ${mode} (expected 3 for osu!mania). This renderer only supports osu!mania beatmaps.`
    );
    process.exit(1);
  }

  return {
    metadata,
    difficulty,
    timingPoints,
    hitObjects,
    audioFile: general["AudioFilename"] || "",
    mode,
    backgroundImage,
    storyboardEvents,
    scrollVelocitySegments,
    fileHash,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const searchTerm = args[0];
  const cheartDir = getCheartDir();
  const osuFiles = listFiles(cheartDir, ".osu");

  if (osuFiles.length === 0) {
    console.error("No .osu files found in cheart/ folder");
    process.exit(1);
  }

  let selectedFile: string | null = null;

  if (searchTerm) {
    selectedFile = matchFile(searchTerm, osuFiles);
    if (!selectedFile) {
      console.error(`Error: No beatmap found matching "${searchTerm}"`);
      process.exit(1);
    }
  } else {
    selectedFile = await selectFile("Select a beatmap:", osuFiles);
  }

  if (!selectedFile) {
    console.error("Error: No beatmap selected");
    process.exit(1);
  }

  const beatmapPath = path.join(cheartDir, selectedFile);

  console.log(`\nLooking for file: ${selectedFile}`);

  if (!fs.existsSync(beatmapPath)) {
    console.error(`Error: Beatmap file not found: ${beatmapPath}`);
    process.exit(1);
  }

  let beatmap: ParsedBeatmap;
  try {
    beatmap = parseOsuFile(beatmapPath);
  } catch (error) {
    console.error(
      `Error parsing beatmap: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }

  // Get source directory (where the .osu file is located)
  const sourceDir = path.dirname(beatmapPath);
  const projectDir = process.cwd();

  // Ensure public directory exists
  const publicDir = path.join(projectDir, "public");

  // Clear public directory before copying new resources
  if (fs.existsSync(publicDir)) {
    fs.rmSync(publicDir, { recursive: true, force: true });
  }
  console.log("Cleared public/ directory");

  // Recreate empty public directory
  fs.mkdirSync(publicDir, { recursive: true });

  // Copy all resources from beatmap directory to public/
  // osu! beatmaps store all assets (audio, images, storyboard) in the same directory
  // and subdirectories, not a specific folder
  function copyRecursive(src: string, dest: string) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        copyRecursive(srcPath, destPath);
      } else if (entry.isFile()) {
        // Skip .osu and .osb files (already parsed)
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === ".osu" || ext === ".osb") continue;

        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  copyRecursive(sourceDir, publicDir);
  console.log(`Copied beatmap resources from ${sourceDir}`);

  // Scan public/ for available hitsound files
  const hitsoundFiles: string[] = [];
  const publicEntries = fs.readdirSync(publicDir);
  for (const entry of publicEntries) {
    const ext = path.extname(entry).toLowerCase();
    // Include .wav and .ogg, but exclude the main audio BGM file
    if ((ext === ".wav" || ext === ".ogg") && !entry.toLowerCase().startsWith("audio.")) {
      hitsoundFiles.push(entry);
    }
  }

  // Write hitsound file list for runtime import
  const hitsoundOutputPath = path.join(projectDir, "src", "generated", "hitsound-files.json");
  fs.writeFileSync(hitsoundOutputPath, JSON.stringify(hitsoundFiles, null, 2));
  console.log(`Found ${hitsoundFiles.length} hitsound files`);

  // Copy .osb storyboard file if exists
  // Try different possible locations: same directory as .osu, or base directory
  let osbSrc = path.join(sourceDir, selectedFile.replace(".osu", ".osb"));
  if (!fs.existsSync(osbSrc)) {
    // Try base directory (osb might be in parent folder without difficulty suffix)
    const baseName = selectedFile.replace(/\s*\[[^\]]+\]\.osu$/, ".osb");
    osbSrc = path.join(cheartDir, baseName);
  }
  const osbDest = path.join(publicDir, "storyboard.osb");

  // Parse storyboard: merge .osu events + .osb events (osb overrides osu for same sprites)
  let mergedStoryboard = null;
  let hasOsbEvents = false;

  // Parse .osu storyboard events if exist
  if (beatmap.storyboardEvents && beatmap.storyboardEvents.length > 0) {
    const osuSbContent =
      "osu file format v14\n\n[Events]\n" +
      beatmap.storyboardEvents.join("\n") +
      "\n";
    const osuSbPath = path.join(publicDir, "storyboard_osu.osb");
    fs.writeFileSync(osuSbPath, osuSbContent);
    console.log(
      `Extracted ${beatmap.storyboardEvents.length} storyboard events from .osu file`,
    );
    const osuSb = parseStoryboardFile(osuSbPath);
    if (osuSb) {
      mergedStoryboard = osuSb;
      console.log(`Parsed .osu storyboard: ${osuSb.objects.length} objects`);
    }
    // Delete temp file
    fs.unlinkSync(osuSbPath);
  }

  // Parse .osb storyboard if exists
  if (fs.existsSync(osbSrc)) {
    fs.copyFileSync(osbSrc, osbDest);
    console.log(`Copied storyboard: ${path.basename(osbSrc)}`);
    hasOsbEvents = true;

    const osbSb = parseStoryboardFile(osbDest);
    if (osbSb) {
      if (mergedStoryboard) {
        // osu! behavior: .osb is parsed AFTER .osu, all sprites are added to the same storyboard
        // Sprites with same path are independent objects (both will render)
        // Simply concatenate all objects - osu! doesn't do any deduplication
        // But we need to renumber IDs to avoid conflicts
        const osuObjectCount = mergedStoryboard.objects.length;
        const renumberedOsbObjects = osbSb.objects.map((obj, index) => ({
          ...obj,
          id:
            obj.type === "sprite"
              ? `sprite_${osuObjectCount + index}`
              : `anim_${osuObjectCount + index}`,
        }));
        mergedStoryboard.objects = [
          ...mergedStoryboard.objects,
          ...renumberedOsbObjects,
        ];
        // Update duration
        if (osbSb.duration > mergedStoryboard.duration) {
          mergedStoryboard.duration = osbSb.duration;
        }
        console.log(
          `Merged storyboard: ${mergedStoryboard.objects.length} objects (.osu: ${osuObjectCount} + .osb: ${osbSb.objects.length})`,
        );
      } else {
        mergedStoryboard = osbSb;
        console.log(`Parsed .osb storyboard: ${osbSb.objects.length} objects`);
      }
    }
  }

  // Write merged storyboard to JSON
  if (mergedStoryboard) {
    const sbOutputPath = path.join(
      process.cwd(),
      "src",
      "generated",
      "storyboard.json",
    );
    fs.writeFileSync(sbOutputPath, JSON.stringify(mergedStoryboard, null, 2));
    console.log(
      `Final storyboard: ${mergedStoryboard.objects.length} objects, ${mergedStoryboard.duration}ms`,
    );
  } else if (
    !hasOsbEvents &&
    (!beatmap.storyboardEvents || beatmap.storyboardEvents.length === 0)
  ) {
    console.log("No storyboard found in .osu or .osb file");
  }



  // Write the parsed beatmap to a JSON file for import
  fs.writeFileSync(
    path.join(process.cwd(), "src", "generated", "beatmap.json"),
    JSON.stringify(beatmap, null, 2),
  );

  console.log("Beatmap parsed and saved to src/generated/beatmap.json");
  console.log(`Found ${beatmap.hitObjects.length} hit objects`);
  console.log(`Title: ${beatmap.metadata.title}`);
  console.log(`Difficulty: ${beatmap.metadata.version}`);
}

main();

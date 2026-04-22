import * as fs from "fs";
import * as path from "path";
import { listFiles, selectFile, matchFile, getCheartDir } from "./selectFile";
import { parseStoryboardFile } from "../src/lib/sbParser";

interface BeatmapMetadata {
  title: string;
  titleUnicode: string;
  artist: string;
  artistUnicode: string;
  creator: string;
  version: string;
  source: string;
  tags: string[];
}

interface BeatmapDifficulty {
  hpDrainRate: number;
  circleSize: number;
  overallDifficulty: number;
  approachRate: number;
  sliderMultiplier: number;
  sliderTickRate: number;
}

interface TimingPoint {
  time: number;
  beatLength: number;
  meter: number;
  sampleSet: number;
  sampleIndex: number;
  volume: number;
  uninherited: boolean;
  effects: number;
}

interface HitObject {
  x: number;
  y: number;
  time: number;
  type: number;
  hitSound: number;
  objectParams: string;
  hitSample: string;
  column: number;
  endTime?: number; // For long notes
  isLongNote: boolean;
}

interface ParsedBeatmap {
  metadata: BeatmapMetadata;
  difficulty: BeatmapDifficulty;
  timingPoints: TimingPoint[];
  hitObjects: HitObject[];
  audioFile: string;
  mode: number;
  backgroundImage?: string;
  storyboardEvents?: string[]; // Storyboard events from .osu file
}

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

  // Parse General
  const generalLines = parseSection(content, "General");
  const general: Record<string, string> = {};
  for (const line of generalLines) {
    const [key, value] = parseKeyValue(line);
    general[key] = value;
  }

  // Parse Events for background and storyboard
  let backgroundImage: string | undefined;
  let storyboardEvents: string[] = [];

  // Also need original lines (with leading spaces) for command parsing
  const allLines = content.split("\n");
  const eventsSectionStart = allLines.findIndex((l) => l.trim() === `[Events]`);

  for (let i = eventsSectionStart + 1; i < allLines.length; i++) {
    const originalLine = allLines[i];
    const line = originalLine.trim();

    // Check if we've reached the next section
    if (line.startsWith("[") && line !== `[Events]`) break;

    // Background: 0,0,"filename",x,y
    if (line.startsWith("0,") || line.startsWith("0,")) {
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
    // Use originalLine to preserve leading spaces for detection
    if (/^\s+[TCFMSRVPML]/.test(originalLine)) {
      storyboardEvents.push(line);
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

      // For LN (type & 128), parts[5] is endTime (ms), parts[6] is hitSample
      // For circle, parts[5] is objectParams, parts[6] is hitSample
      const isLongNote = (type & 128) !== 0;
      const endTimeStr = isLongNote ? parts[5] || "" : "";
      const endTime = isLongNote ? parseInt(endTimeStr) : undefined;
      const objectParams = !isLongNote ? parts[5] || "" : "";
      const hitSample = parts[6] || "";

      // Calculate column based on x position
      const column = Math.floor(x / 128);

      hitObjects.push({
        x,
        y,
        time,
        type,
        hitSound,
        objectParams,
        hitSample,
        column,
        endTime,
        isLongNote,
      });
    }
  }

  return {
    metadata,
    difficulty,
    timingPoints,
    hitObjects,
    audioFile: general["AudioFilename"] || "",
    mode: parseInt(general["Mode"]) || 0,
    backgroundImage,
    storyboardEvents,
  };
}

// Default beatmap (fallback)
const DEFAULT_BEATMAP =
  "void (Mournfinale) feat. Hoshikuma Minami - Testify (Akasha-) [Transcend your Limit Fatal End].osu";

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
    // Try to match the search term
    selectedFile = matchFile(searchTerm, osuFiles);
    if (!selectedFile && osuFiles.length <= 3) {
      // If match failed and only a few files, don't ask - just use default
      console.log("Using default beatmap.");
    } else if (!selectedFile) {
      // Multiple matches or no match - let user choose
      selectedFile = await selectFile("Available beatmaps:", osuFiles);
    }
  } else {
    // No argument - show menu
    selectedFile = await selectFile("Select a beatmap:", osuFiles);
  }

  const beatmapFile = selectedFile || DEFAULT_BEATMAP;
  const beatmapPath = path.join(cheartDir, beatmapFile);

  console.log(`\nLooking for file: ${beatmapFile}`);
  console.log(`File exists: ${fs.existsSync(beatmapPath)}`);

  const beatmap = parseOsuFile(beatmapPath);

  // Get source directory (where the .osu file is located)
  const sourceDir = path.dirname(beatmapPath);
  const projectDir = process.cwd();

  // Ensure public directory exists
  const publicDir = path.join(projectDir, "public");
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Copy audio file to public folder
  if (beatmap.audioFile) {
    const audioSrc = path.join(sourceDir, beatmap.audioFile);
    const audioDest = path.join(publicDir, "audio.mp3");
    if (fs.existsSync(audioSrc)) {
      fs.copyFileSync(audioSrc, audioDest);
      console.log(`Copied audio: ${beatmap.audioFile}`);
    } else {
      console.log(`Audio file not found: ${audioSrc}`);
    }
  }

  // Copy background image to public folder (keep original filename)
  if (beatmap.backgroundImage) {
    // Remove quotes if present
    const bgFile = beatmap.backgroundImage.replace(/^"|"$/g, "");
    const bgSrc = path.join(sourceDir, bgFile);
    const bgDest = path.join(publicDir, bgFile);
    if (fs.existsSync(bgSrc)) {
      fs.copyFileSync(bgSrc, bgDest);
      console.log(`Copied background: ${bgFile}`);
    } else {
      console.log(`Background file not found: ${bgSrc}`);
    }
  }

  // Copy .osb storyboard file if exists
  // Try different possible locations: same directory as .osu, or base directory
  let osbSrc = path.join(sourceDir, beatmapFile.replace(".osu", ".osb"));
  if (!fs.existsSync(osbSrc)) {
    // Try base directory (osb might be in parent folder without difficulty suffix)
    const baseName = beatmapFile.replace(/\s*\[[^\]]+\]\.osu$/, ".osb");
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
        mergedStoryboard.objects = [
          ...mergedStoryboard.objects,
          ...osbSb.objects,
        ];
        // Update duration
        if (osbSb.duration > mergedStoryboard.duration) {
          mergedStoryboard.duration = osbSb.duration;
        }
        console.log(
          `Merged storyboard: ${mergedStoryboard.objects.length} objects (.osu: ${mergedStoryboard.objects.length - osbSb.objects.length} + .osb: ${osbSb.objects.length})`,
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
      "lib",
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

  // Copy all image files referenced in storyboard (including subdirectories)
  const storyboardDir = path.join(sourceDir, "Storyboard");
  if (fs.existsSync(storyboardDir)) {
    const sbDestDir = path.join(publicDir, "Storyboard");
    if (!fs.existsSync(sbDestDir)) {
      fs.mkdirSync(sbDestDir, { recursive: true });
    }

    // Recursively copy all files in Storyboard folder
    function copyDirRecursive(src: string, dest: string) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          copyDirRecursive(srcPath, destPath);
        } else if (entry.isFile()) {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }

    copyDirRecursive(storyboardDir, sbDestDir);
    console.log(`Copied storyboard assets from ${storyboardDir}`);
  }

  // Write the parsed beatmap to a JSON file for import
  fs.writeFileSync(
    path.join(process.cwd(), "src", "lib", "beatmap.json"),
    JSON.stringify(beatmap, null, 2),
  );

  console.log("Beatmap parsed and saved to src/lib/beatmap.json");
  console.log(`Found ${beatmap.hitObjects.length} hit objects`);
  console.log(`Title: ${beatmap.metadata.title}`);
  console.log(`Difficulty: ${beatmap.metadata.version}`);
}

main();

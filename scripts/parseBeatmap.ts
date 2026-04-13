import * as fs from "fs";
import * as path from "path";

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
  console.log("General lines:", generalLines.length);
  const general: Record<string, string> = {};
  for (const line of generalLines) {
    const [key, value] = parseKeyValue(line);
    general[key] = value;
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
      const objectParams = parts[5] || "";
      const hitSample = parts[6] || "";

      // LN detection: type bit 7 (128) = slider (long note in mania)
      const isLongNote = (type & 128) !== 0;

      // Calculate end time for LNs
      let endTime: number | undefined;
      if (isLongNote && objectParams) {
        // objectParams format: length:edgeSounds:edgeAdditions
        const length = parseFloat(objectParams.split(":")[0]) || 0;
        if (length > 0) {
          // Find the applicable timing point for this time
          let beatLength = 300; // default
          for (let i = timingPoints.length - 1; i >= 0; i--) {
            if (timingPoints[i].time <= time) {
              beatLength = timingPoints[i].beatLength;
              break;
            }
          }
          // Calculate end time: duration = length / (sliderMultiplier * 1000) * beatLength
          const sliderVelocity = difficulty.sliderMultiplier * 1000;
          const durationMs = (length / sliderVelocity) * beatLength;
          endTime = time + durationMs;
        }
      }

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
  };
}

const beatmapPath = path.join(
  process.cwd(),
  "cheart",
  "Jiang Mi Tiao & Daily Tian Li - Spasmodic (Haocore Mix) (NineSey) [QwertYui345's Extreme].osu"
);

console.log("Looking for file:", beatmapPath);
console.log("File exists:", fs.existsSync(beatmapPath));

const beatmap = parseOsuFile(beatmapPath);

// Write the parsed beatmap to a JSON file for import
fs.writeFileSync(
  path.join(process.cwd(), "src", "lib", "beatmap.json"),
  JSON.stringify(beatmap, null, 2)
);

console.log("Beatmap parsed and saved to src/lib/beatmap.json");
console.log(`Found ${beatmap.hitObjects.length} hit objects`);
console.log(`Title: ${beatmap.metadata.title}`);
console.log(`Difficulty: ${beatmap.metadata.version}`);
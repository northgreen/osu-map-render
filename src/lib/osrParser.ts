import * as fs from "fs";
import * as zlib from "zlib";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const lzma = require("lzma");

export interface ReplayData {
  mode: number;
  gameVersion: number;
  beatmapHash: string;
  playerName: string;
  replayHash: string;
  count300: number;
  count100: number;
  count50: number;
  countGeki: number;
  countKatu: number;
  countMiss: number;
  totalScore: number;
  maxCombo: number;
  perfect: boolean;
  mods: number;
  lifeData: { time: number; life: number }[];
  timestamp: number;
  replayData: ReplayFrame[];
  onlineScoreId: number;
}

export interface ReplayFrame {
  timeOffset: number; // ms since last frame
  x: number;
  y: number;
  keys: number; // bit combination
}

// Parse ULEB128 encoded integer
function parseULEB128(buffer: Buffer, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let pos = offset;

  while (true) {
    const byte = buffer[pos++];
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }

  return [result, pos - offset];
}

// Parse string from buffer
function parseString(buffer: Buffer, offset: number): [string, number] {
  const prefix = buffer[offset];

  if (prefix === 0x00) {
    return ["", 1];
  }

  if (prefix === 0x0b) {
    const [length, lengthSize] = parseULEB128(buffer, offset + 1);
    const stringStart = offset + 1 + lengthSize;
    const string = buffer.toString("utf8", stringStart, stringStart + length);
    return [string, 1 + lengthSize + length];
  }

  return ["", 0];
}

// Decompress LZMA/raw replay data
function decompressReplayData(compressedData: Buffer): Buffer {
  // Try LZMA first (most common for osu! replays)
  try {
    const decompressed = lzma.decompress(compressedData);
    if (decompressed && decompressed.length > 0) {
      return Buffer.from(decompressed);
    }
  } catch {
    // Continue to other methods
  }

  // Try zlib decompression
  try {
    return zlib.inflateRawSync(compressedData);
  } catch {
    // Try raw decompression
    try {
      return zlib.inflateSync(compressedData);
    } catch {
      // Try gunzip
      try {
        return zlib.gunzipSync(compressedData);
      } catch {
        // Return as-is if decompression fails
        console.warn("Failed to decompress replay data, using raw data");
        return compressedData;
      }
    }
  }
}

// Parse replay data string into frames
function parseReplayDataString(dataStr: string): ReplayFrame[] {
  const frames: ReplayFrame[] = [];
  const lines = dataStr.split(",");

  for (const line of lines) {
    const parts = line.trim().split("|");
    if (parts.length >= 4) {
      // Format: timeOffset|x|y|z (all are actually stored as integers in the data)
      const timeOffset = parseInt(parts[0]);
      // In osu!mania, x represents the key/column (0,1,2,3 for 4K)
      // y is always 192 (judgment line)
      // z is the key bitmask
      const x = parseInt(parts[1]);
      const y = parseInt(parts[2]);
      const keys = parseInt(parts[3]);

      if (!isNaN(timeOffset)) {
        frames.push({ timeOffset, x, y, keys });
      }
    }
  }

  return frames;
}

// Mod constants
export const MOD_NOFAIL = 1;
export const MOD_EASY = 2;
export const MOD_HIDDEN = 8;
export const MOD_HARDROCK = 16;
export const MOD_DOUBLETIME = 64;
export const MOD_NIGHTCORE = 512;
export const MOD_PERFECT = 16384;

export function parseOsuReplay(filePath: string): ReplayData | null {
  try {
    const buffer = fs.readFileSync(filePath);
    let offset = 0;

    // Mode (1 byte)
    const mode = buffer[offset++];

    // Game version (4 bytes, little endian)
    const gameVersion = buffer.readInt32LE(offset);
    offset += 4;

    // Beatmap MD5 hash (string)
    const [beatmapHash, hashLen] = parseString(buffer, offset);
    offset += hashLen;

    // Player name (string)
    const [playerName, nameLen] = parseString(buffer, offset);
    offset += nameLen;

    // Replay hash (string)
    const [replayHash, replayHashLen] = parseString(buffer, offset);
    offset += replayHashLen;

    // Counts (each 2 bytes, little endian)
    const count300 = buffer.readInt16LE(offset);
    offset += 2;
    const count100 = buffer.readInt16LE(offset);
    offset += 2;
    const count50 = buffer.readInt16LE(offset);
    offset += 2;
    const countGeki = buffer.readInt16LE(offset);
    offset += 2;
    const countKatu = buffer.readInt16LE(offset);
    offset += 2;
    const countMiss = buffer.readInt16LE(offset);
    offset += 2;

    // Total score (4 bytes)
    const totalScore = buffer.readInt32LE(offset);
    offset += 4;

    // Max combo (2 bytes)
    const maxCombo = buffer.readInt16LE(offset);
    offset += 2;

    // Perfect (1 byte)
    const perfect = buffer[offset++] === 1;

    // Mods (4 bytes)
    const mods = buffer.readInt32LE(offset);
    offset += 4;

    // Life data (string)
    const [lifeDataStr, lifeLen] = parseString(buffer, offset);
    offset += lifeLen;

    // Parse life data
    const lifeData: { time: number; life: number }[] = [];
    if (lifeDataStr) {
      const lifeParts = lifeDataStr.split(",");
      for (const part of lifeParts) {
        const [time, life] = part.split("|");
        if (time !== undefined && life !== undefined) {
          lifeData.push({ time: parseFloat(time), life: parseFloat(life) });
        }
      }
    }

    // Timestamp (8 bytes, Windows ticks) - convert to number
    const timestamp = Number(buffer.readBigInt64LE(offset));
    offset += 8;

    // Replay data length (4 bytes)
    const replayDataLength = buffer.readInt32LE(offset);
    offset += 4;

    // Replay data (compressed)
    let replayData: ReplayFrame[] = [];
    if (replayDataLength > 0) {
      const compressedData = buffer.slice(offset, offset + replayDataLength);
      const decompressed = decompressReplayData(compressedData);
      const dataStr = decompressed.toString("utf8");
      replayData = parseReplayDataString(dataStr);
      offset += replayDataLength;
    }

    // Online score ID (8 bytes)
    const onlineScoreId = Number(buffer.readBigInt64LE(offset));

    return {
      mode,
      gameVersion,
      beatmapHash,
      playerName,
      replayHash,
      count300,
      count100,
      count50,
      countGeki,
      countKatu,
      countMiss,
      totalScore,
      maxCombo,
      perfect,
      mods,
      lifeData,
      timestamp,
      replayData,
      onlineScoreId,
    };
  } catch (error) {
    console.error("Error parsing .osr file:", error);
    return null;
  }
}

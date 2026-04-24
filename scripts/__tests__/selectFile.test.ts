import { describe, it, expect } from "vitest";
import { matchFile } from "../selectFile";

// ============================================
// selectFile Tests
// ============================================

describe("matchFile", () => {
  const files = [
    "artist - title [difficulty].osu",
    "another song [Hard].osu",
    "test beatmap [Normal].osu",
  ];

  it("should return exact match", () => {
    const result = matchFile("artist - title [difficulty].osu", files);
    expect(result).toBe("artist - title [difficulty].osu");
  });

  it("should match by partial keyword", () => {
    const result = matchFile("artist", files);
    expect(result).toBe("artist - title [difficulty].osu");
  });

  it("should match case-insensitively", () => {
    const result = matchFile("ARTIST", files);
    expect(result).toBe("artist - title [difficulty].osu");
  });

  it("should match by difficulty name", () => {
    const result = matchFile("Hard", files);
    expect(result).toBe("another song [Hard].osu");
  });

  it("should return null when no match found", () => {
    const result = matchFile("nonexistent", files);
    expect(result).toBeNull();
  });

  it("should return first match when multiple files match", () => {
    const result = matchFile("test", files);
    expect(result).toBe("test beatmap [Normal].osu");
  });
});

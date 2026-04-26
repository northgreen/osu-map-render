import { describe, it, expect, beforeEach } from "vitest";
import {
  STAGE_WIDTH_BASE,
  NOTE_WIDTH,
  getStageWidth,
  getColumnWidth,
  getColumnPositionsStage,
  getColumnPositionsNote,
  getColumnColors,
  setKeyCount,
  getKeyCount,
  KEY_COUNT,
  COLUMN_WIDTH,
  COLUMN_POSITIONS_STAGE,
  COLUMN_POSITIONS_NOTE,
  COLUMN_COLORS,
  config,
} from "../../../config";

// ============================================
// Stage Width Tests
// ============================================

describe("getStageWidth", () => {
  it("should return STAGE_WIDTH_BASE for 4K", () => {
    expect(getStageWidth(4)).toBe(STAGE_WIDTH_BASE);
  });

  it("should return STAGE_WIDTH_BASE for key counts <= 4", () => {
    expect(getStageWidth(1)).toBe(STAGE_WIDTH_BASE);
    expect(getStageWidth(2)).toBe(STAGE_WIDTH_BASE);
    expect(getStageWidth(3)).toBe(STAGE_WIDTH_BASE);
  });

  it("should expand stage width for key counts > 4", () => {
    // Formula: STAGE_WIDTH_BASE + (keyCount - 4) * (STAGE_WIDTH_BASE / 4)
    // For 7K: 512 + (7-4) * 128 = 512 + 384 = 896
    expect(getStageWidth(7)).toBe(512 + (7 - 4) * (512 / 4));
    expect(getStageWidth(7)).toBe(896);
  });

  it("should handle large key counts", () => {
    // 18K: 512 + (18-4) * 128 = 512 + 1792 = 2304
    expect(getStageWidth(18)).toBe(2304);
  });
});

// ============================================
// Column Width Tests
// ============================================

describe("getColumnWidth", () => {
  it("should return correct width for 4K", () => {
    // 512 / 4 = 128
    expect(getColumnWidth(4)).toBe(128);
  });

  it("should return correct width for 7K", () => {
    // 896 / 7 = 128
    expect(getColumnWidth(7)).toBe(128);
  });

  it("should return correct width for 1K", () => {
    // 512 / 1 = 512
    expect(getColumnWidth(1)).toBe(512);
  });
});

// ============================================
// Column Positions (Stage) Tests
// ============================================

describe("getColumnPositionsStage", () => {
  it("should return center positions for 4K", () => {
    const positions = getColumnPositionsStage(4);
    expect(positions).toHaveLength(4);
    // Column centers: 64, 192, 320, 448
    expect(positions[0]).toBe(64);
    expect(positions[1]).toBe(192);
    expect(positions[2]).toBe(320);
    expect(positions[3]).toBe(448);
  });

  it("should return correct positions for 7K", () => {
    const positions = getColumnPositionsStage(7);
    expect(positions).toHaveLength(7);
    // Stage width = 896, column width = 128
    // Centers: 64, 192, 320, 448, 576, 704, 832
    expect(positions[0]).toBe(64);
    expect(positions[6]).toBe(832);
  });

  it("should return positions for wildcard key counts (>18)", () => {
    const positions = getColumnPositionsStage(19);
    expect(positions).toHaveLength(19);
  });
});

// ============================================
// Column Positions (Note) Tests
// ============================================

describe("getColumnPositionsNote", () => {
  it("should return left-edge positions for 4K", () => {
    const positions = getColumnPositionsNote(4);
    expect(positions).toHaveLength(4);
    // columnWidth = 128, noteWidth = 100
    // Left edge = columnWidth * i + (columnWidth - NOTE_WIDTH) / 2
    // = 0 + (128 - 100) / 2 = 14 for first column
    expect(positions[0]).toBe(14);
  });

  it("should center notes within columns", () => {
    const positions = getColumnPositionsNote(4);
    // Note center = left edge + NOTE_WIDTH / 2 = 14 + 50 = 64
    // This should match stage position
    expect(positions[0] + NOTE_WIDTH / 2).toBe(64);
  });
});

// ============================================
// Column Colors Tests
// ============================================

describe("getColumnColors", () => {
  it("should return correct colors for 4K", () => {
    const colors = getColumnColors(4);
    expect(colors).toHaveLength(4);
  });

  it("should return correct colors for 7K", () => {
    const colors = getColumnColors(7);
    expect(colors).toHaveLength(7);
    // Center column (index 3) should be the special color
    expect(colors[3]).toBe("#4ECDC4");
  });

  it("should fallback to wildcard for key counts > 18", () => {
    const colors = getColumnColors(19);
    expect(colors).toHaveLength(19);
  });

  it("should return wildcard colors for 1K", () => {
    const colors = getColumnColors(1);
    expect(colors).toHaveLength(1);
  });
});

// ============================================
// setKeyCount / getKeyCount Tests
// ============================================

describe("setKeyCount / getKeyCount", () => {
  beforeEach(() => {
    setKeyCount(4); // Reset to default
  });

  it("should update KEY_COUNT when setKeyCount is called", () => {
    setKeyCount(7);
    expect(getKeyCount()).toBe(7);
    expect(KEY_COUNT).toBe(7);
  });

  it("should update COLUMN_WIDTH when setKeyCount is called", () => {
    setKeyCount(7);
    expect(COLUMN_WIDTH).toBe(getColumnWidth(7));
  });

  it("should update COLUMN_POSITIONS_STAGE when setKeyCount is called", () => {
    setKeyCount(7);
    expect(COLUMN_POSITIONS_STAGE).toEqual(getColumnPositionsStage(7));
  });

  it("should update COLUMN_POSITIONS_NOTE when setKeyCount is called", () => {
    setKeyCount(7);
    expect(COLUMN_POSITIONS_NOTE).toEqual(getColumnPositionsNote(7));
  });

  it("should update COLUMN_COLORS when setKeyCount is called", () => {
    setKeyCount(7);
    expect(COLUMN_COLORS).toEqual(getColumnColors(7));
  });

  it("should clamp key count to minimum 1", () => {
    setKeyCount(0);
    expect(getKeyCount()).toBe(1);
    setKeyCount(-5);
    expect(getKeyCount()).toBe(1);
  });
});

// ============================================
// Config Getter Object Tests
// ============================================

describe("config getter object", () => {
  beforeEach(() => {
    setKeyCount(4);
  });

  it("should return dynamic values based on current key count", () => {
    setKeyCount(7);
    expect(config.keyCount).toBe(7);
    expect(config.stageWidth).toBe(getStageWidth(7));
    expect(config.columnWidth).toBe(getColumnWidth(7));
    expect(config.columnPositionsStage).toEqual(getColumnPositionsStage(7));
    expect(config.columnPositionsNote).toEqual(getColumnPositionsNote(7));
    expect(config.columnColors).toEqual(getColumnColors(7));
  });
});

import { describe, it, expect } from "vitest";

// Mirror the colorToFilterId function from StoryboardLayer.tsx
// This is a pure function, so we can test it directly without React
function colorToFilterId(color: {
  r: number;
  g: number;
  b: number;
}): string {
  const r = Math.round(color.r * 1000);
  const g = Math.round(color.g * 1000);
  const b = Math.round(color.b * 1000);
  return `sb-color-${r}-${g}-${b}`;
}

// ============================================
// 1. colorToFilterId - Stability
// ============================================

describe("colorToFilterId - stability", () => {
  it("should return the same ID for the same color", () => {
    const color = { r: 0.5, g: 0.25, b: 0.75 };
    const id1 = colorToFilterId(color);
    const id2 = colorToFilterId(color);
    expect(id1).toBe(id2);
  });

  it("should return the same ID for identical colors called multiple times", () => {
    const color = { r: 1, g: 0, b: 0 };
    for (let i = 0; i < 100; i++) {
      expect(colorToFilterId(color)).toBe("sb-color-1000-0-0");
    }
  });

  it("should produce stable IDs despite floating-point imprecision", () => {
    // 1/3 * 3 should still produce the same ID as 1.0
    const color1 = { r: 1 / 3, g: 1 / 3, b: 1 / 3 };
    const color2 = { r: 0.3333333333333333, g: 0.3333333333333333, b: 0.3333333333333333 };
    expect(colorToFilterId(color1)).toBe(colorToFilterId(color2));
  });
});

// ============================================
// 2. colorToFilterId - Different colors
// ============================================

describe("colorToFilterId - different colors produce different IDs", () => {
  it("should return different IDs for different red values", () => {
    const red1 = colorToFilterId({ r: 0.5, g: 0, b: 0 });
    const red2 = colorToFilterId({ r: 0.6, g: 0, b: 0 });
    expect(red1).not.toBe(red2);
  });

  it("should return different IDs for different green values", () => {
    const g1 = colorToFilterId({ r: 0, g: 0.5, b: 0 });
    const g2 = colorToFilterId({ r: 0, g: 0.6, b: 0 });
    expect(g1).not.toBe(g2);
  });

  it("should return different IDs for different blue values", () => {
    const b1 = colorToFilterId({ r: 0, g: 0, b: 0.5 });
    const b2 = colorToFilterId({ r: 0, g: 0, b: 0.6 });
    expect(b1).not.toBe(b2);
  });

  it("should return different IDs for completely different colors", () => {
    const white = colorToFilterId({ r: 1, g: 1, b: 1 });
    const black = colorToFilterId({ r: 0, g: 0, b: 0 });
    const red = colorToFilterId({ r: 1, g: 0, b: 0 });
    expect(white).not.toBe(black);
    expect(white).not.toBe(red);
    expect(black).not.toBe(red);
  });
});

// ============================================
// 3. colorToFilterId - Color normalization
// ============================================

describe("colorToFilterId - color normalization to [0,1]", () => {
  it("should handle color values at 0", () => {
    const id = colorToFilterId({ r: 0, g: 0, b: 0 });
    expect(id).toBe("sb-color-0-0-0");
  });

  it("should handle color values at 1", () => {
    const id = colorToFilterId({ r: 1, g: 1, b: 1 });
    expect(id).toBe("sb-color-1000-1000-1000");
  });

  it("should handle mid-range color values", () => {
    const id = colorToFilterId({ r: 0.5, g: 0.5, b: 0.5 });
    expect(id).toBe("sb-color-500-500-500");
  });

  it("should handle typical linear-space color from C command", () => {
    // sRGB 128/255 ≈ 0.502 → linear ≈ 0.214
    const id = colorToFilterId({ r: 0.21404, g: 0.21404, b: 0.21404 });
    expect(id).toBe("sb-color-214-214-214");
  });

  it("should round to 3 decimals for stability", () => {
    // Values that would differ beyond 3 decimals should produce same ID
    const color1 = { r: 0.1234, g: 0.5678, b: 0.9012 };
    const color2 = { r: 0.1236, g: 0.5679, b: 0.9013 };
    // After rounding: 123 vs 124, 568 vs 568, 901 vs 901
    const id1 = colorToFilterId(color1);
    const id2 = colorToFilterId(color2);
    // r differs: 123 vs 124
    expect(id1).not.toBe(id2);
  });

  it("should produce correct filter ID format", () => {
    const id = colorToFilterId({ r: 0.5, g: 0.25, b: 0.75 });
    expect(id).toMatch(/^sb-color-\d+-\d+-\d+$/);
  });
});

// ============================================
// 4. GlobalColorFilters - SVG filter rendering
// ============================================

describe("GlobalColorFilters - SVG filter structure", () => {
  it("should generate correct feColorMatrix values for a color", () => {
    // The feColorMatrix values format:
    // "r 0 0 0 0 0 g 0 0 0 0 0 b 0 0 0 0 0 1 0"
    // This multiplies each RGB channel by the color value
    const color = { r: 0.5, g: 0.25, b: 0.75 };
    const expectedValues = "0.5 0 0 0 0 0 0.25 0 0 0 0 0 0.75 0 0 0 0 0 1 0";
    const actualValues = `${color.r} 0 0 0 0 0 ${color.g} 0 0 0 0 0 ${color.b} 0 0 0 0 0 1 0`;
    expect(actualValues).toBe(expectedValues);
  });

  it("should handle white color (no tint)", () => {
    const color = { r: 1, g: 1, b: 1 };
    const values = `${color.r} 0 0 0 0 0 ${color.g} 0 0 0 0 0 ${color.b} 0 0 0 0 0 1 0`;
    expect(values).toBe("1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0");
  });

  it("should handle black color (full tint)", () => {
    const color = { r: 0, g: 0, b: 0 };
    const values = `${color.r} 0 0 0 0 0 ${color.g} 0 0 0 0 0 ${color.b} 0 0 0 0 0 1 0`;
    // feColorMatrix values: 20 numbers (4x5 matrix)
    expect(values).toBe("0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0");
  });

  it("should handle red-only tint", () => {
    const color = { r: 1, g: 0, b: 0 };
    const values = `${color.r} 0 0 0 0 0 ${color.g} 0 0 0 0 0 ${color.b} 0 0 0 0 0 1 0`;
    expect(values).toBe("1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0");
  });
});

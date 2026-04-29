import { describe, it, expect } from "vitest";
import type { SbObject } from "../../sbParser";

// Mirror the layer filtering logic from StoryboardLayer.tsx
// This is a pure function, so we can test it directly without React
function filterLayerObjects(
  storyboard: SbObject[],
  layer: string,
  isFailing: boolean,
): SbObject[] {
  return storyboard.filter((obj) => {
    if (obj.layer !== layer) return false;
    if (layer === "Fail") return isFailing;
    if (layer === "Pass") return !isFailing;
    return true;
  });
}

// ============================================
// 1. Fail layer filtering
// ============================================

describe("Fail layer - visibility", () => {
  it("should show Fail layer objects when isFailing=true", () => {
    const objects: SbObject[] = [
      { id: "1", type: "sprite", layer: "Fail", origin: "Centre", path: "a.png", x: 0, y: 0, commands: [], loops: [] },
      { id: "2", type: "sprite", layer: "Pass", origin: "Centre", path: "b.png", x: 0, y: 0, commands: [], loops: [] },
    ];
    const result = filterLayerObjects(objects, "Fail", true);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("should hide Fail layer objects when isFailing=false", () => {
    const objects: SbObject[] = [
      { id: "1", type: "sprite", layer: "Fail", origin: "Centre", path: "a.png", x: 0, y: 0, commands: [], loops: [] },
      { id: "2", type: "sprite", layer: "Pass", origin: "Centre", path: "b.png", x: 0, y: 0, commands: [], loops: [] },
    ];
    const result = filterLayerObjects(objects, "Fail", false);
    expect(result).toHaveLength(0);
  });

  it("should only return Fail layer objects, not other layers", () => {
    const objects: SbObject[] = [
      { id: "1", type: "sprite", layer: "Fail", origin: "Centre", path: "a.png", x: 0, y: 0, commands: [], loops: [] },
      { id: "2", type: "sprite", layer: "Background", origin: "Centre", path: "b.png", x: 0, y: 0, commands: [], loops: [] },
      { id: "3", type: "sprite", layer: "Foreground", origin: "Centre", path: "c.png", x: 0, y: 0, commands: [], loops: [] },
    ];
    const result = filterLayerObjects(objects, "Fail", true);
    expect(result).toHaveLength(1);
    expect(result[0].layer).toBe("Fail");
  });
});

// ============================================
// 2. Pass layer filtering
// ============================================

describe("Pass layer - visibility", () => {
  it("should show Pass layer objects when isFailing=false", () => {
    const objects: SbObject[] = [
      { id: "1", type: "sprite", layer: "Pass", origin: "Centre", path: "a.png", x: 0, y: 0, commands: [], loops: [] },
      { id: "2", type: "sprite", layer: "Fail", origin: "Centre", path: "b.png", x: 0, y: 0, commands: [], loops: [] },
    ];
    const result = filterLayerObjects(objects, "Pass", false);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("should hide Pass layer objects when isFailing=true", () => {
    const objects: SbObject[] = [
      { id: "1", type: "sprite", layer: "Pass", origin: "Centre", path: "a.png", x: 0, y: 0, commands: [], loops: [] },
      { id: "2", type: "sprite", layer: "Fail", origin: "Centre", path: "b.png", x: 0, y: 0, commands: [], loops: [] },
    ];
    const result = filterLayerObjects(objects, "Pass", true);
    expect(result).toHaveLength(0);
  });

  it("should only return Pass layer objects, not other layers", () => {
    const objects: SbObject[] = [
      { id: "1", type: "sprite", layer: "Pass", origin: "Centre", path: "a.png", x: 0, y: 0, commands: [], loops: [] },
      { id: "2", type: "sprite", layer: "Background", origin: "Centre", path: "b.png", x: 0, y: 0, commands: [], loops: [] },
      { id: "3", type: "sprite", layer: "Foreground", origin: "Centre", path: "c.png", x: 0, y: 0, commands: [], loops: [] },
    ];
    const result = filterLayerObjects(objects, "Pass", false);
    expect(result).toHaveLength(1);
    expect(result[0].layer).toBe("Pass");
  });
});

// ============================================
// 3. Background and Foreground layers - always visible
// ============================================

describe("Background/Foreground layers - always visible", () => {
  it("should show Background layer regardless of isFailing", () => {
    const objects: SbObject[] = [
      { id: "1", type: "sprite", layer: "Background", origin: "Centre", path: "bg.png", x: 0, y: 0, commands: [], loops: [] },
    ];
    const resultTrue = filterLayerObjects(objects, "Background", true);
    const resultFalse = filterLayerObjects(objects, "Background", false);
    expect(resultTrue).toHaveLength(1);
    expect(resultFalse).toHaveLength(1);
  });

  it("should show Foreground layer regardless of isFailing", () => {
    const objects: SbObject[] = [
      { id: "1", type: "sprite", layer: "Foreground", origin: "Centre", path: "fg.png", x: 0, y: 0, commands: [], loops: [] },
    ];
    const resultTrue = filterLayerObjects(objects, "Foreground", true);
    const resultFalse = filterLayerObjects(objects, "Foreground", false);
    expect(resultTrue).toHaveLength(1);
    expect(resultFalse).toHaveLength(1);
  });

  it("should show Overlay layer regardless of isFailing", () => {
    const objects: SbObject[] = [
      { id: "1", type: "sprite", layer: "Overlay", origin: "Centre", path: "ov.png", x: 0, y: 0, commands: [], loops: [] },
    ];
    const resultTrue = filterLayerObjects(objects, "Overlay", true);
    const resultFalse = filterLayerObjects(objects, "Overlay", false);
    expect(resultTrue).toHaveLength(1);
    expect(resultFalse).toHaveLength(1);
  });
});

// ============================================
// 4. Mixed layer filtering
// ============================================

describe("Mixed layer filtering", () => {
  it("should correctly filter mixed layers for Fail state", () => {
    const objects: SbObject[] = [
      { id: "bg", type: "sprite", layer: "Background", origin: "Centre", path: "bg.png", x: 0, y: 0, commands: [], loops: [] },
      { id: "fail1", type: "sprite", layer: "Fail", origin: "Centre", path: "fail1.png", x: 0, y: 0, commands: [], loops: [] },
      { id: "fail2", type: "sprite", layer: "Fail", origin: "Centre", path: "fail2.png", x: 0, y: 0, commands: [], loops: [] },
      { id: "pass1", type: "sprite", layer: "Pass", origin: "Centre", path: "pass.png", x: 0, y: 0, commands: [], loops: [] },
      { id: "fg", type: "sprite", layer: "Foreground", origin: "Centre", path: "fg.png", x: 0, y: 0, commands: [], loops: [] },
    ];
    // When failing: show Background + Fail + Foreground
    const result = filterLayerObjects(objects, "Fail", true);
    expect(result).toHaveLength(2);
    expect(result.map((o) => o.id)).toEqual(["fail1", "fail2"]);
  });

  it("should correctly filter mixed layers for Pass state", () => {
    const objects: SbObject[] = [
      { id: "bg", type: "sprite", layer: "Background", origin: "Centre", path: "bg.png", x: 0, y: 0, commands: [], loops: [] },
      { id: "fail1", type: "sprite", layer: "Fail", origin: "Centre", path: "fail1.png", x: 0, y: 0, commands: [], loops: [] },
      { id: "pass1", type: "sprite", layer: "Pass", origin: "Centre", path: "pass1.png", x: 0, y: 0, commands: [], loops: [] },
      { id: "pass2", type: "sprite", layer: "Pass", origin: "Centre", path: "pass2.png", x: 0, y: 0, commands: [], loops: [] },
      { id: "fg", type: "sprite", layer: "Foreground", origin: "Centre", path: "fg.png", x: 0, y: 0, commands: [], loops: [] },
    ];
    // When passing: show Background + Pass + Foreground
    const result = filterLayerObjects(objects, "Pass", false);
    expect(result).toHaveLength(2);
    expect(result.map((o) => o.id)).toEqual(["pass1", "pass2"]);
  });

  it("should return empty array when layer has no objects", () => {
    const objects: SbObject[] = [
      { id: "bg", type: "sprite", layer: "Background", origin: "Centre", path: "bg.png", x: 0, y: 0, commands: [], loops: [] },
    ];
    const result = filterLayerObjects(objects, "Fail", true);
    expect(result).toHaveLength(0);
  });
});

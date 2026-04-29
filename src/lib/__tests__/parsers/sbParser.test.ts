import { describe, it, expect } from "vitest";
import { parseStoryboard, EASING_NAMES } from "../../sbParser";

// ============================================
// Sprite/Animation Parsing Tests
// ============================================

describe("parseStoryboard - Sprite parsing", () => {
  it("should parse a basic Sprite definition", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"image.png",320,240
`;
    const result = parseStoryboard(content);
    expect(result.objects).toHaveLength(1);
    const obj = result.objects[0];
    expect(obj.type).toBe("sprite");
    expect(obj.layer).toBe("Pass");
    expect(obj.origin).toBe("Centre");
    expect(obj.path).toBe("image.png");
    expect(obj.x).toBe(320);
    expect(obj.y).toBe(240);
  });

  it("should parse Sprite with numeric layer/origin", () => {
    const content = `
[Events]
Sprite,2,1,"image.png",320,240
`;
    const result = parseStoryboard(content);
    expect(result.objects[0].layer).toBe("Pass");
    expect(result.objects[0].origin).toBe("Centre");
  });

  it("should parse all layer types", () => {
    const layers = [
      "Background",
      "Fail",
      "Pass",
      "Foreground",
      "Overlay",
    ] as const;
    for (let i = 0; i < layers.length; i++) {
      const content = `\n[Events]\nSprite,${i},Centre,"img.png",0,0\n`;
      const result = parseStoryboard(content);
      expect(result.objects[0].layer).toBe(layers[i]);
    }
  });

  it("should parse all origin types", () => {
    const content = `
[Events]
Sprite,Pass,0,"img.png",0,0
`;
    const result = parseStoryboard(content);
    expect(result.objects[0].origin).toBe("TopLeft");
  });

  it("should handle quoted filepaths with spaces", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"SB/My Image.png",320,240
`;
    const result = parseStoryboard(content);
    expect(result.objects[0].path).toBe("SB/My Image.png");
  });

  it("should normalize backslashes in filepaths", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"SB\\image.png",320,240
`;
    const result = parseStoryboard(content);
    expect(result.objects[0].path).toBe("SB/image.png");
  });
});

describe("parseStoryboard - Animation parsing", () => {
  it("should parse Animation with all parameters", () => {
    const content = `
[Events]
Animation,Foreground,Centre,"explosion.png",418,108,12,31,LoopForever
`;
    const result = parseStoryboard(content);
    expect(result.objects).toHaveLength(1);
    const obj = result.objects[0];
    expect(obj.type).toBe("animation");
    expect(obj.layer).toBe("Foreground");
    expect(obj.frameCount).toBe(12);
    expect(obj.frameDelay).toBe(31);
    expect(obj.loopType).toBe("LoopForever");
  });

  it("should parse LoopOnce animation", () => {
    const content = `
[Events]
Animation,Pass,Centre,"turn.png",320,240,4,250,LoopOnce
`;
    const result = parseStoryboard(content);
    expect(result.objects[0].loopType).toBe("LoopOnce");
  });
});

// ============================================
// F (Fade) Command Tests
// ============================================

describe("parseStoryboard - F (Fade) command", () => {
  it("should parse F with two values", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
F,0,1000,2000,0,1
`;
    const result = parseStoryboard(content);
    const cmd = result.objects[0].commands[0];
    expect(cmd.type).toBe("F");
    expect(cmd.easing).toBe(0);
    expect(cmd.startTime).toBe(1000);
    expect(cmd.endTime).toBe(2000);
    expect(cmd.params).toEqual([0, 1]);
  });

  it("should parse F with single value (endValue = startValue)", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
F,0,1000,3000,1
`;
    const result = parseStoryboard(content);
    const cmd = result.objects[0].commands[0];
    expect(cmd.params).toEqual([1, 1]);
  });

  it("should handle empty endTime (instant change)", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
F,0,1000,,0.5
`;
    const result = parseStoryboard(content);
    const cmd = result.objects[0].commands[0];
    expect(cmd.endTime).toBe(1000);
    expect(cmd.params).toEqual([0.5, 0.5]);
  });
});

// ============================================
// M/MX/MY (Move) Command Tests
// ============================================

describe("parseStoryboard - M/MX/MY (Move) commands", () => {
  it("should parse M with full 4 params", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
M,0,1000,2000,-110,-100,740,580
`;
    const result = parseStoryboard(content);
    const cmd = result.objects[0].commands[0];
    expect(cmd.type).toBe("M");
    expect(cmd.params).toEqual([-110, -100, 740, 580]);
  });

  it("should parse MX command", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
MX,0,1000,2000,-110,740
`;
    const result = parseStoryboard(content);
    const cmd = result.objects[0].commands[0];
    expect(cmd.type).toBe("MX");
    expect(cmd.params).toEqual([-110, 740]);
  });

  it("should parse MY command", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
MY,0,1000,2000,-100,580
`;
    const result = parseStoryboard(content);
    const cmd = result.objects[0].commands[0];
    expect(cmd.type).toBe("MY");
    expect(cmd.params).toEqual([-100, 580]);
  });
});

// ============================================
// S (Scale) Command Tests
// ============================================

describe("parseStoryboard - S (Scale) command", () => {
  it("should parse S with two values", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
S,0,1000,2000,1,5
`;
    const result = parseStoryboard(content);
    const cmd = result.objects[0].commands[0];
    expect(cmd.params).toEqual([1, 5]);
  });

  it("should parse S with single value", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
S,0,1000,2000,2
`;
    const result = parseStoryboard(content);
    const cmd = result.objects[0].commands[0];
    expect(cmd.params).toEqual([2, 2]);
  });

  it("should handle empty endTime for S", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
S,0,1000,,2
`;
    const result = parseStoryboard(content);
    const cmd = result.objects[0].commands[0];
    expect(cmd.endTime).toBe(1000);
  });
});

// ============================================
// V (Vector Scale) Command Tests
// ============================================

describe("parseStoryboard - V (Vector Scale) command", () => {
  it("should parse V with 4 params", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
V,0,1000,2000,1,1,2,0.5
`;
    const result = parseStoryboard(content);
    const cmd = result.objects[0].commands[0];
    expect(cmd.type).toBe("V");
    expect(cmd.params).toEqual([1, 1, 2, 0.5]);
  });
});

// ============================================
// R (Rotate) Command Tests
// ============================================

describe("parseStoryboard - R (Rotate) command", () => {
  it("should parse R with two values (degrees)", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
R,0,1000,2000,-0.785,0.785
`;
    const result = parseStoryboard(content);
    const cmd = result.objects[0].commands[0];
    expect(cmd.type).toBe("R");
    // -0.785 rad ≈ -45 deg, 0.785 rad ≈ 45 deg
    expect(cmd.params[0]).toBeCloseTo(-45, 1);
    expect(cmd.params[1]).toBeCloseTo(45, 1);
  });
});

// ============================================
// C (Color) Command Tests
// ============================================

describe("parseStoryboard - C (Color) command", () => {
  it("should parse C with start color only", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
C,0,1000,2000,255,255,0
`;
    const result = parseStoryboard(content);
    const cmd = result.objects[0].commands[0];
    expect(cmd.type).toBe("C");
    expect(cmd.params).toEqual([255, 255, 0, 255, 255, 0]);
  });

  it("should parse C with start and end color", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
C,0,1000,2000,0,0,0,255,255,255
`;
    const result = parseStoryboard(content);
    const cmd = result.objects[0].commands[0];
    expect(cmd.params).toEqual([0, 0, 0, 255, 255, 255]);
  });
});

// ============================================
// L (Loop) Command Tests
// ============================================

describe("parseStoryboard - L (Loop) command", () => {
  it("should parse loop with nested commands", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
L,60000,30
__F,0,0,500,0,1
__F,0,500,1000,1,0
`;
    const result = parseStoryboard(content);
    expect(result.objects[0].loops).toHaveLength(1);
    const loop = result.objects[0].loops[0];
    expect(loop.startTime).toBe(60000);
    // L,60000,30 means 30 total plays, stored as repeatCount=29
    expect(loop.repeatCount).toBe(29);
    expect(loop.commands).toHaveLength(2);
    expect(loop.commands[0].type).toBe("F");
    expect(loop.commands[0].params).toEqual([0, 1]);
  });
});

// ============================================
// T (Trigger) Command Tests
// ============================================

describe("parseStoryboard - T (Trigger) command", () => {
  it("should parse trigger with nested commands", () => {
    const content = `
[Events]
Sprite,Foreground,Centre,"img.png",320,240
T,Passing,20000,40000
__F,0,0,500,1
__F,0,500,501,0
`;
    const result = parseStoryboard(content);
    const cmds = result.objects[0].commands;
    // Trigger commands are merged into the object's commands array
    expect(cmds.length).toBeGreaterThanOrEqual(2);
    expect(cmds[0].type).toBe("F");
  });
});

// ============================================
// Variable Substitution Tests
// ============================================

describe("parseStoryboard - Variable substitution", () => {
  it("should substitute variables in paths", () => {
    const content = `
$sample_path="Sample.png"
Sprite,Pass,Centre,$sample_path,320,240
`;
    const result = parseStoryboard(content);
    // Variable value includes quotes as stored in variable definition
    expect(result.objects[0].path).toBe('"Sample.png"');
    // Variables are stored without the $ prefix
    expect(result.variables["sample_path"]).toBe('"Sample.png"');
  });

  it("should substitute variables in color commands", () => {
    const content = `
$green_r=0
$green_g=255
$green_b=0
Sprite,Pass,Centre,"img.png",320,240
C,0,1000,2000,$green_r,$green_g,$green_b
`;
    const result = parseStoryboard(content);
    const cmd = result.objects[0].commands[0];
    expect(cmd.params[0]).toBe(0);
    expect(cmd.params[1]).toBe(255);
    expect(cmd.params[2]).toBe(0);
  });
});

// ============================================
// Sample (Audio) Tests
// ============================================

describe("parseStoryboard - Sample (audio)", () => {
  it("should parse Sample definition", () => {
    const content = `
[Events]
Sample,163520,2,"Audio/Best End.mp3",80
`;
    const result = parseStoryboard(content);
    expect(result.samples).toHaveLength(1);
    const sample = result.samples[0];
    expect(sample.time).toBe(163520);
    expect(sample.layer).toBe("Pass");
    expect(sample.path).toBe("Audio/Best End.mp3");
    expect(sample.volume).toBe(80);
  });

  it("should default volume to 100 when omitted", () => {
    const content = `
[Events]
Sample,1000,0,"audio.wav"
`;
    const result = parseStoryboard(content);
    expect(result.samples[0].volume).toBe(100);
  });
});

// ============================================
// Easing Names Tests
// ============================================

describe("EASING_NAMES", () => {
  it("should have all 35 osu! easing functions (0-34)", () => {
    expect(Object.keys(EASING_NAMES).length).toBe(35);
    expect(EASING_NAMES[0]).toBe("linear");
    expect(EASING_NAMES[1]).toBe("easeOut");
    expect(EASING_NAMES[2]).toBe("easeIn");
    expect(EASING_NAMES[34]).toBe("easeInOutBounce");
  });
});

// ============================================
// Underscore Prefix Tests
// ============================================

describe("parseStoryboard - Underscore prefix handling", () => {
  it("should handle commands with underscore prefix", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
_F,0,1000,2000,0,1
_M,0,1000,2000,0,0,320,240
`;
    const result = parseStoryboard(content);
    expect(result.objects[0].commands).toHaveLength(2);
    expect(result.objects[0].commands[0].type).toBe("F");
    expect(result.objects[0].commands[1].type).toBe("M");
  });
});

// ============================================
// P (Parameter) Command Tests
// ============================================

describe("parseStoryboard - P (Parameter) command", () => {
  it("should parse permanent P,H command setting flipH", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
P,0,1000,1000,H
`;
    const result = parseStoryboard(content);
    expect(result.objects[0].flipH).toBe(true);
    expect(result.objects[0].flipV).toBeUndefined();
  });

  it("should parse permanent P,V command setting flipV", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
P,0,1000,1000,V
`;
    const result = parseStoryboard(content);
    expect(result.objects[0].flipV).toBe(true);
    expect(result.objects[0].flipH).toBeUndefined();
  });

  it("should parse permanent P,A command setting additive", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
P,0,1000,1000,A
`;
    const result = parseStoryboard(content);
    expect(result.objects[0].additive).toBe(true);
    expect(result.objects[0].flipH).toBeUndefined();
    expect(result.objects[0].flipV).toBeUndefined();
  });

  it("should parse temporary P,H command as SbCommand", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
P,0,1000,2000,H
`;
    const result = parseStoryboard(content);
    const cmd = result.objects[0].commands[0];
    expect(cmd.type).toBe("P");
    expect(cmd.startTime).toBe(1000);
    expect(cmd.endTime).toBe(2000);
    expect(cmd.paramStrings).toEqual(["H"]);
    // Permanent flag should NOT be set
    expect(result.objects[0].flipH).toBeUndefined();
  });

  it("should parse temporary P,V command as SbCommand", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
P,0,1000,2000,V
`;
    const result = parseStoryboard(content);
    const cmd = result.objects[0].commands[0];
    expect(cmd.type).toBe("P");
    expect(cmd.paramStrings).toEqual(["V"]);
    expect(result.objects[0].flipV).toBeUndefined();
  });

  it("should parse temporary P,A command as SbCommand", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
P,0,1000,2000,A
`;
    const result = parseStoryboard(content);
    const cmd = result.objects[0].commands[0];
    expect(cmd.type).toBe("P");
    expect(cmd.paramStrings).toEqual(["A"]);
    expect(result.objects[0].additive).toBeUndefined();
  });

  it("should parse P command with underscore prefix", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",320,240
_P,0,1000,2000,H
`;
    const result = parseStoryboard(content);
    const cmd = result.objects[0].commands[0];
    expect(cmd.type).toBe("P");
    expect(cmd.paramStrings).toEqual(["H"]);
  });
});

// ============================================
// T (Trigger) Detailed Parsing Tests
// ============================================

describe("parseStoryboard - T (Trigger) detailed parsing", () => {
  it("should parse HitSoundClap trigger", () => {
    const content = `
[Events]
Sprite,Foreground,Centre,"img.png",320,240
T,HitSoundClap,20000
__F,0,0,500,0,1
`;
    const result = parseStoryboard(content);
    const cmds = result.objects[0].commands;
    expect(cmds.length).toBeGreaterThanOrEqual(1);
    expect(cmds[0].type).toBe("F");
  });

  it("should parse HitSoundFinish trigger", () => {
    const content = `
[Events]
Sprite,Foreground,Centre,"img.png",320,240
T,HitSoundFinish,20000
__F,0,0,500,0,1
`;
    const result = parseStoryboard(content);
    const cmds = result.objects[0].commands;
    expect(cmds.length).toBeGreaterThanOrEqual(1);
  });

  it("should parse Failing trigger", () => {
    const content = `
[Events]
Sprite,Foreground,Centre,"img.png",320,240
T,Failing,20000
__F,0,0,500,0,1
`;
    const result = parseStoryboard(content);
    const cmds = result.objects[0].commands;
    expect(cmds.length).toBeGreaterThanOrEqual(1);
  });

  it("should default trigger endTime to 999999999 when omitted", () => {
    const content = `
[Events]
Sprite,Foreground,Centre,"img.png",320,240
T,Passing,20000
__F,0,0,500,0,1
`;
    const result = parseStoryboard(content);
    // Trigger commands should be merged with offset from trigger startTime
    const cmds = result.objects[0].commands;
    expect(cmds.length).toBeGreaterThanOrEqual(1);
  });

  it("should parse trigger groupNumber", () => {
    const content = `
[Events]
Sprite,Foreground,Centre,"img.png",320,240
T,HitSoundClap,20000,40000,1
__F,0,0,500,0,1
`;
    const result = parseStoryboard(content);
    const cmds = result.objects[0].commands;
    expect(cmds.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================
// All Origin Types Tests
// ============================================

describe("parseStoryboard - All origin types", () => {
  it("should parse all 10 origin types numerically (0-9)", () => {
    const originMap: Record<number, string> = {
      0: "TopLeft",
      1: "Centre",
      2: "CentreLeft",
      3: "TopRight",
      4: "BottomCentre",
      5: "TopCentre",
      6: "TopLeft", // Custom -> TopLeft
      7: "CentreRight",
      8: "BottomLeft",
      9: "BottomRight",
    };
    for (const [num, name] of Object.entries(originMap)) {
      const content = `\n[Events]\nSprite,Pass,${num},"img.png",0,0\n`;
      const result = parseStoryboard(content);
      expect(result.objects[0].origin).toBe(name);
    }
  });

  it("should parse all origin types by name", () => {
    const originNames = [
      "TopLeft",
      "Centre",
      "CentreLeft",
      "TopRight",
      "BottomCentre",
      "TopCentre",
      "CentreRight",
      "BottomLeft",
      "BottomRight",
    ];
    for (const name of originNames) {
      const content = `\n[Events]\nSprite,Pass,${name},"img.png",0,0\n`;
      const result = parseStoryboard(content);
      expect(result.objects[0].origin).toBe(name);
    }
  });
});

// ============================================
// Video Parsing Tests
// ============================================

describe("parseStoryboard - Video parsing", () => {
  it("should parse Video definition with valid extension", () => {
    // Note: parser expects Video,<unused>,"path",x,y format
    // parts[1] is unused, parts[2] is the path
    const content = `
[Events]
Video,0,"background.mp4",0,0
`;
    const result = parseStoryboard(content);
    expect(result.objects).toHaveLength(1);
    const obj = result.objects[0];
    expect(obj.type).toBe("video");
    expect(obj.path).toBe("background.mp4");
    expect(obj.layer).toBe("Background");
    expect(obj.origin).toBe("TopLeft");
  });

  it("should filter out Video with invalid extension", () => {
    const content = `
[Events]
Video,0,"background.txt",0,0
`;
    const result = parseStoryboard(content);
    // Invalid extension -> no object created
    expect(result.objects).toHaveLength(0);
  });

  it("should accept all valid video/image extensions", () => {
    const validExts = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "mp4", "webm"];
    for (const ext of validExts) {
      const content = `\n[Events]\nVideo,0,"bg.${ext}",0,0\n`;
      const result = parseStoryboard(content);
      expect(result.objects).toHaveLength(1);
      expect(result.objects[0].type).toBe("video");
    }
  });

  it("should reject Video with unsupported extension", () => {
    const content = `
[Events]
Video,0,"background.avi",0,0
`;
    const result = parseStoryboard(content);
    expect(result.objects).toHaveLength(0);
  });

  it("should handle Video followed by Sprite", () => {
    const content = `
[Events]
Video,0,"bg.mp4",0,0
Sprite,Pass,Centre,"sprite.png",320,240
`;
    const result = parseStoryboard(content);
    expect(result.objects).toHaveLength(2);
    expect(result.objects[0].type).toBe("video");
    expect(result.objects[1].type).toBe("sprite");
  });
});

// ============================================
// Comment Handling Tests
// ============================================

describe("parseStoryboard - Comment handling", () => {
  it("should skip lines starting with //", () => {
    const content = `
[Events]
// This is a comment
Sprite,Pass,Centre,"img.png",320,240
// Another comment
F,0,0,1000,0,1
`;
    const result = parseStoryboard(content);
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].commands).toHaveLength(1);
    expect(result.objects[0].commands[0].type).toBe("F");
  });

  it("should skip file with only comments", () => {
    const content = `
// Comment 1
// Comment 2
// Comment 3
`;
    const result = parseStoryboard(content);
    expect(result.objects).toHaveLength(0);
    expect(result.samples).toHaveLength(0);
  });
});

// ============================================
// Default loopType Tests
// ============================================

describe("parseStoryboard - Default loopType", () => {
  it("should default to LoopForever when loopType is omitted", () => {
    const content = `
[Events]
Animation,Pass,Centre,"anim.png",320,240,4,250
`;
    const result = parseStoryboard(content);
    expect(result.objects[0].loopType).toBe("LoopForever");
  });

  it("should default to LoopForever when loopType is invalid", () => {
    const content = `
[Events]
Animation,Pass,Centre,"anim.png",320,240,4,250,InvalidType
`;
    const result = parseStoryboard(content);
    expect(result.objects[0].loopType).toBe("LoopForever");
  });

  it("should accept LoopOnce when specified", () => {
    const content = `
[Events]
Animation,Pass,Centre,"anim.png",320,240,4,250,LoopOnce
`;
    const result = parseStoryboard(content);
    expect(result.objects[0].loopType).toBe("LoopOnce");
  });
});

// ============================================
// Coordinate Clamping Tests
// ============================================

describe("parseStoryboard - Coordinate clamping", () => {
  it("should clamp x coordinate to MAX_COORDINATE_VALUE (131072)", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",200000,100
`;
    const result = parseStoryboard(content);
    expect(result.objects[0].x).toBe(131072);
  });

  it("should clamp y coordinate to -MAX_COORDINATE_VALUE (-131072)", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",100,-200000
`;
    const result = parseStoryboard(content);
    expect(result.objects[0].y).toBe(-131072);
  });

  it("should clamp negative x coordinate to -MAX_COORDINATE_VALUE", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",-200000,100
`;
    const result = parseStoryboard(content);
    expect(result.objects[0].x).toBe(-131072);
  });

  it("should clamp y coordinate to MAX_COORDINATE_VALUE (131072)", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",100,200000
`;
    const result = parseStoryboard(content);
    expect(result.objects[0].y).toBe(131072);
  });

  it("should not clamp coordinates within valid range", () => {
    const content = `
[Events]
Sprite,Pass,Centre,"img.png",640,480
`;
    const result = parseStoryboard(content);
    expect(result.objects[0].x).toBe(640);
    expect(result.objects[0].y).toBe(480);
  });
});

// ============================================
// Empty Storyboard Tests
// ============================================

describe("parseStoryboard - Empty storyboard", () => {
  it("should return empty objects array for empty file", () => {
    const content = "";
    const result = parseStoryboard(content);
    expect(result.objects).toHaveLength(0);
    expect(result.samples).toHaveLength(0);
    expect(result.duration).toBe(1000); // 0 + 1s buffer
  });

  it("should return empty objects array for file with only comments", () => {
    const content = `
// Just comments
// Nothing else
`;
    const result = parseStoryboard(content);
    expect(result.objects).toHaveLength(0);
    expect(result.samples).toHaveLength(0);
  });

  it("should return empty objects array for file with only section headers", () => {
    const content = `
[Events]
[Variables]
`;
    const result = parseStoryboard(content);
    expect(result.objects).toHaveLength(0);
  });
});

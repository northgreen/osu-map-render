import { z } from "zod";

export const maniaRenderContentsSchema = z.object({
  trackHeight: z.boolean().default(true),
  columnHighlights: z.boolean().default(true),
  replayCursor: z.boolean().default(true),
  sessionLine: z.boolean().default(true),
  storyboardEnabled: z.boolean().default(false),
  bgDarken: z.number().min(0).max(1).multipleOf(0.01).default(0),
  bgBlur: z.number().min(0).max(20).default(0),
  stageBgOpacity: z.number().min(0).multipleOf(0.01).max(1).default(1),
  hitsounds: z
    .object({
      enabled: z.boolean().default(true),
      trigger: z.enum(["auto", "manual"]).default("auto"),
      volume: z.number().min(0).max(1).default(1.0),
    })
    .default({
      enabled: true,
      trigger: "auto",
      volume: 1.0,
    }),
  hitOffsetIndicator: z
    .object({
      enabled: z.boolean().default(false),
      x: z.number().default(0),
      y: z.number().default(540),
      width: z.number().default(600),
      height: z.number().default(30),
      timeWindow: z.number().default(3000),
      maxHits: z.number().default(0),
      maxOffset: z.number().default(0),
      showCenterLine: z.boolean().default(true),
      showLabels: z.boolean().default(false),
    })
    .default({
      enabled: false,
      x: 0,
      y: 540,
      width: 600,
      height: 30,
      timeWindow: 3000,
      maxHits: 0,
      maxOffset: 0,
      showCenterLine: true,
      showLabels: false,
    }),
});

export const maniaRenderSchema = z.object({
  time: z.object({
    beatOffset: z.number().min(0),
    timeOffset: z.number(),
  }),
  scroll: z.object({
    scrollSpeed: z.number().min(5).max(50),
  }),
  judgment: z.object({
    mode: z.enum(["v1", "v2", "custom"]).default("v2"),
    offset: z.number().default(0),
    showZones: z.boolean().default(false),
    customWindows: z
      .object({
        perfect: z.number().optional(),
        great: z.number().optional(),
        good: z.number().optional(),
        ok: z.number().optional(),
        meh: z.number().optional(),
      })
      .optional(),
  }),
  layout: z.object({
    stageOffset: z.number().default(0),
    judgmentLineY: z.number().min(100).max(1000).default(900),
    judgmentTextY: z.number().min(0).max(1080).default(750),
  }),
  contents: maniaRenderContentsSchema.default({
    trackHeight: true,
    columnHighlights: true,
    replayCursor: true,
    sessionLine: true,
    storyboardEnabled: false,
    bgDarken: 0.0,
    bgBlur: 0.0,
    stageBgOpacity: 1.0,
    hitsounds: {
      enabled: true,
      trigger: "auto",
      volume: 1.0,
    },
    hitOffsetIndicator: {
      enabled: false,
      x: 0,
      y: 540,
      width: 600,
      height: 30,
      timeWindow: 3000,
      maxHits: 0,
      maxOffset: 0,
      showCenterLine: true,
      showLabels: false,
    },
  }),
});

export type ManiaRenderProps = z.infer<typeof maniaRenderSchema>;

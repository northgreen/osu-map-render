# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Remotion v4 project for rendering osu!mania beatmap videos using React. It supports beatmap rendering, replay playback visualization, judgment calculation, storyboard rendering, and dynamic key count configuration (1K-18K+).

## Commands

```bash
rtk npm run dev                          # Start Remotion Studio (live preview)
rtk npm run build                        # Bundle the project (auto-runs parse via prebuild)
rtk npm run lint                         # Run ESLint + TypeScript
rtk npm run parse                        # Parse beatmap to JSON + copy assets (auto-parses storyboard)
rtk npm run parse -- "keyword"           # Parse beatmap matching keyword (fuzzy search)
rtk npm run parse:replay                 # Parse .osr replay file to JSON
rtk npm run parse:replay -- "keyword"    # Parse replay matching keyword (fuzzy search)
rtk npm run parse:storyboard             # Parse storyboard.osb to JSON (standalone)
rtk npx remotion render ManiaRender out/video.mp4  # Render full osu!mania video
rtk npx remotion render ManiaStageOnly out/video.mp4  # Stage layer only
rtk npx remotion render ManiaBackground out/video.mp4  # Background layer only
rtk npx remotion render ManiaOverlayOnly out/video.mp4  # Overlay only
rtk npx remotion render ManiaReplayCursorOnly out/video.mp4  # Replay cursor only
rtk npm run upgrade                      # Upgrade Remotion version
```

## Architecture

### Render Pipeline
```
cheart/*.osu ──parse──▶ src/lib/beatmap.json ──import──▶ Rendering
replay/*.osr ──parse──▶ src/lib/replay.json  ──import──▶ Rendering
storyboard.osb ─parse──▶ src/lib/storyboard.json ──import▶ Rendering
     └─ also extracted from .osu [Events] section during parse
```

### Layer Structure (back to front)
1. **Background** (`ManiaBackground.tsx`) - Background image + all storyboard layers (Background, Fail, Pass, Foreground, Overlay)
2. **Stage** (`ManiaStageLayer.tsx`) - Beat lines, notes, judgment line, column dividers, key press indicators, hit effects, column highlights
3. **Overlay** (`ManiaOverlay.tsx`) - Metadata, score, combo, PP, judgment stats, live judgment indicator
4. **Replay Cursor** (`ReplayCursor.tsx`) - Falling key press/release bars colored by judgment

### Composition IDs
- `ManiaRender` - Full render (all layers combined)
- `ManiaBackground` - Background + storyboard only
- `ManiaStageOnly` - Stage (notes, judgment line, key presses, hit effects)
- `ManiaOverlayOnly` - Overlay (score, combo, PP, metadata)
- `ManiaReplayCursorOnly` - Replay cursor falling bars only

### Key Files
| File | Purpose |
|------|---------|
| `src/index.ts` | Remotion entry point, registers `<Composition>` definitions |
| `src/Root.tsx` | Defines all compositions with schemas, defaultProps, duration |
| `src/ManiaRender.tsx` | Combined render composing all layers |
| `src/config.ts` | Scroll speed, note dimensions, column positions/colors, dynamic key count |
| `src/lib/osuParser.ts` | Types for parsed beatmap, exports `beatmap` from beatmap.json |
| `src/lib/replay.ts` | Types for replay, exports `replay` from replay.json |
| `src/lib/sbParser.ts` | Full osu! storyboard parser (Sprite, Animation, L/M/S/R/C/F/V/P commands) |
| `src/lib/StoryboardLayer.tsx` | Renders storyboard objects with all 35 easing functions |
| `src/lib/judgment.ts` | Hit windows, judgment calculation (v1/v2/custom), LN tail support |
| `src/lib/difficulty.ts` | Star rating, PP, realtime PP calculation |
| `scripts/parseBeatmap.ts` | Parses .osu → JSON, copies audio/bg/images, merges storyboard |
| `scripts/parseReplay.ts` | Parses .osr → replay.json |
| `scripts/parseStoryboard.ts` | Standalone storyboard parser |
| `scripts/selectFile.ts` | Interactive file selection helper |

### Data Flow
1. `npm run parse` reads `cheart/*.osu`, outputs `src/lib/beatmap.json`
2. Beatmap parser also extracts storyboard events from `[Events]` section
3. If `*.osb` file exists alongside the .osu, it is merged with .osu storyboard events
4. `parseBeatmap.ts` copies audio, background images, and storyboard assets to `public/`
5. Components import parsed JSON directly: `import beatmap from "./lib/beatmap.json"`
6. Same pattern for replay (`replay.json`) and storyboard (`storyboard.json`)

## Configuration

### Dynamic Key Count (`src/config.ts`)
The config supports 1K through 18K+ with automatic position/color calculation:
- `setKeyCount(count)` - Updates mutable exports (`KEY_COUNT`, `COLUMN_POSITIONS_STAGE`, etc.)
- `config` object - Alternative access via getters (e.g., `config.columnColors`)
- `getColumnColors(k)`, `getColumnPositionsStage(k)`, `getColumnPositionsNote(k)` - Get by key count
- Stage width expands for 5K+: `STAGE_WIDTH_BASE + (keyCount - 4) * (STAGE_WIDTH_BASE / 4)`
- Key count is auto-set from beatmap's `CircleSize` at module load in `Root.tsx`

### Config Values
- `SCROLL_SPEED` (default: 37) - Note fall speed
- `BASE_VISIBLE_TIME` (default: 1800ms) - Visible time at scroll speed 10
- `NOTE_WIDTH` (100), `NOTE_HEIGHT` (40) - Note dimensions
- `STAGE_X` (64), `STAGE_WIDTH_BASE` (512), `STAGE_HEIGHT` (1080)
- `JUDGMENT_LINE_Y` (900) - Judgment line Y position
- `HIT_EFFECT_DURATION` (30ms) - Hit effect fade duration
- `LN_BODY_OPACITY` (0.4) - Long note body opacity

### Composition Props (Zod schemas in `Root.tsx`)
Props are nested objects:
- `time.beatOffset` (default: 900) - Pre-beatmap lead time in ms
- `time.timeOffset` (default: 0) - Additional time offset
- `scroll.scrollSpeed` (5-50, default: 20)
- `judgment.mode` ("v1" | "v2" | "custom", default: "v2")
- `judgment.offset` (default: 0) - Timing offset in ms
- `judgment.showZones` (default: false)
- `judgment.customWindows` - Custom hit windows (for "custom" mode)
- `layout.stageOffset` (default: 0) - Horizontal stage shift
- `layout.judgmentLineY` (100-1000, default: 900)
- `contents.trackHeight`, `contents.columnHighlights`, `contents.replayCursor`, `contents.sessionLine`, `contents.storyboardEnabled`

## Judgment System (`src/lib/judgment.ts`)

Three modes: **v1** (Classic), **v2** (ScoreV2), **custom** (user-defined windows)
- `setJudgmentMode(mode)`, `setJudgmentOffset(ms)`, `setCustomWindows(windows)` - Setters
- `getHitWindows(od)` - Returns hit windows based on current mode + OD
- `calculateJudgment(hitTime, noteTime, od)` - Returns "Perfect" | "Great" | "Good" | "Ok" | "Meh" | "Miss"
- `calculateJudgments(hitObjects, od)` - Full match: key presses → notes, including LN tails
- `getJudgmentResults(hitObjects, od)` - Cached wrapper around calculateJudgments
- `getKeyIntervals()` - Returns key press/release intervals for ReplayCursor
- Scoring: Perfect=320, Great=300, Good=200, Ok=100, Meh=50, Miss=0
- State is module-level mutable (not React state) - changes take effect immediately

## Storyboard (`src/lib/sbParser.ts` + `src/lib/StoryboardLayer.tsx`)

### Parser supports:
- Sprite, Animation objects with all 5 layers (Background, Fail, Pass, Foreground, Overlay)
- Commands: F (Fade), M (Move), MX/MY, S (Scale), V (Vector Scale), R (Rotate), C (Color), P (Param: flipH/flipV/additive)
- L (Loop), T (Trigger) with nested commands
- Variables (`$VAR=value`) with substitution
- All 35 osu! easing functions mapped 0-34
- Merging .osu `[Events]` storyboard with standalone `.osb` file

### Rendering:
- 640x480 storyboard space → 1920x1080 render (scale factor: `RENDER_HEIGHT / 480 = 2.25`)
- Origin points: 9 positions (TopLeft, Centre, CentreLeft, etc.)
- Color commands use hue/saturation/brightness CSS filters
- Additive blending via `mixBlendMode: "screen"`
- Animation frame index calculated from `frameCount` + `frameDelay`

## Beatmap & Replay Source

- **Beatmaps**: `cheart/` folder (`.osu` files)
- **Replays**: `replay/` folder (`.osr` files)
- **Storyboard images**: Copied to `public/Storyboard/` during parse
- **Audio**: Copied to `public/audio.mp3` during parse
- **Background images**: Copied to `public/` during parse

## Important Implementation Details

- **JSON imports**: TypeScript resolves `.json` imports via `"resolveJsonModule": true` in tsconfig
- **Tailwind v4**: Enabled via `@remotion/tailwind-v4` in `remotion.config.ts`
- **Module-level state**: Judgment mode/offset, key count are mutable module-level variables
- **Caching**: Judgment results and difficulty calculations are cached; cleared on mode change
- **CSS variables**: Stage positioning uses `--stage-x` and `--stage-width` CSS custom properties
- **osu! source code**: Available at `~/Projects/osu/` for reference
see also: @OSU-SBDOC.md

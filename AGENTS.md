# AGENTS.md

对于toolcall不要直接输出xml

所有行为都以osu原版的行为为准，如果不确定某个行为的话请参考osu的行为，另外也可以阅读提供的文档来理解osu的行为

## Project

Remotion 4.x project for rendering osu!mania beatmap videos. React + TypeScript + Tailwind v4.

## Setup & Commands

```bash
npm install                    # Install deps
npm run parse                  # Parse .osu beatmap -> src/generated/beatmap.json (copies audio/bg/storyboard to public/)
npm run parse -- "keyword"     # Fuzzy search beatmap by keyword
npm run parse:replay           # Parse .osr replay -> src/generated/replay.json
npm run dev                    # Remotion Studio (live preview)
npm run lint                   # ESLint + tsc
npm run test                   # Run vitest unit tests
npm run build                  # Bundle (runs parse:replay? no - runs `prebuild` which runs parse)
npx remotion render ManiaRender out/video.mp4  # Full render
```

**Critical order**: Run `npm run parse` before build/render. `prebuild` script runs parse automatically on `npm run build`, but not on direct `remotion render` calls.

## Generated Files (gitignored)

- `src/generated/beatmap.json` - parsed beatmap data
- `src/generated/replay.json` - parsed replay data
- `src/generated/storyboard.json` - parsed storyboard data
- `public/audio.mp3` - audio from beatmap
- `public/background.jpg` etc. - background images
- `public/Storyboard/` - storyboard assets

These are **not in git**. Must regenerate after clone or beatmap change.

## Architecture

### Layer pipeline (back to front)

1. **ManiaBackground** - static bg image + storyboard overlay
2. **ManiaStageLayer** - notes, judgment line, key press effects, hit effects, replay cursor
3. **ManiaOverlay** - score, combo, accuracy, metadata display

### Compositions (all 1920x1080, 60fps)

- `ManiaRender` - all layers combined
- `ManiaBackground` - background + storyboard only
- `ManiaStageOnly` - stage layer only
- `ManiaOverlayOnly` - overlay only
- `ManiaReplayCursorOnly` - replay cursor bars only

### Props schema (nested zod v4)

Props are nested objects: `{ time: { beatOffset, timeOffset }, scroll: { scrollSpeed }, judgment: { mode, offset, showZones, customWindows }, layout: { stageOffset, judgmentLineY }, contents: { trackHeight, columnhigHlights, replayCursor, sessionLine, storyboardEnabled } }`

### Key count is dynamic

`setKeyCount()` in `src/config.ts` is called at module load from beatmap's `difficulty.circleSize`. All column positions, colors, and stage width are computed from this. Changing key count requires re-parsing beatmap.

### Judgment modes

- `v1` (Classic): simplified formula `base[od] + 3 * (10 - od)`
- `v2` (ScoreV2): DifficultyRange algorithm
- `custom`: explicit ms windows via `customWindows` prop

### Replay data flow

`.osr` files searched in: `replay/` > `cheart/` > root. Parsed via `src/lib/osrParser.ts` (LZMA/zlib decompression). Key presses stored as `frame.x` bitmask for mania mode.

## Key Directories

| Path                 | Purpose                                                            |
| -------------------- | ------------------------------------------------------------------ |
| `cheart/`            | .osu beatmap files (source)                                        |
| `replay/`            | .osr replay files (source)                                         |
| `src/lib/`           | Parsers (osuParser, osrParser, sbParser, judgment, difficulty)     |
| `src/lib/__tests__/` | Unit tests for lib modules                                         |
| `src/generated/`     | Auto-generated JSON data (beatmap, replay, storyboard)             |
| `scripts/`           | CLI parse scripts (parseBeatmap.ts, parseReplay.ts, selectFile.ts) |
| `public/`            | Runtime assets (audio, images, storyboard)                         |

## Toolchain Notes

- **zod v4** (`zod@4.3.6`) - use `z.object()`, `z.enum()`, `z.infer<>`
- **Tailwind v4** via `@remotion/tailwind-v4` in remotion.config.ts
- **TypeScript**: strict, noEmit, resolves JSON modules (`"resolveJsonModule": true`)
- **ESLint**: uses `@remotion/eslint-config-flat` (flat config in `eslint.config.mjs`)
- **Vitest** - test framework for unit tests (`npm run test`)
- **Prettier**: 2-space, no tabs, bracketSpacing true

## Reference Documentation

When unsure about storyboard behavior or osu! specific implementation details:

1. **OSU-SBDOC.md** - Chinese translation of official osu! storyboarding specifications. Contains detailed documentation on:
   - Sprite/Animation object syntax and parameters
   - All command types (F/M/S/V/R/C/P) with examples
   - Easing functions (0-34)
   - Loop (L) and Trigger (T) commands
   - Variable substitution
   - Shorthand syntax rules
   - Layer priority and rendering order

2. **Original osu! source code** - Available at `~/Projects/osu/` for reference on:
   - Hit window calculations
   - Judgment algorithms
   - ScoreV1/ScoreV2 differences
   - Replay data format
   - StoryBoard Logic
   - and so on

3. **Parsed JSON outputs** - Check `src/generated/storyboard.json` for actual parsed data structure and command sequences

# AGENTS.md

## Project

Remotion 4.x project for rendering osu!mania beatmap videos. React + TypeScript + Tailwind v4.

## Setup & Commands

```bash
npm install                    # Install deps
npm run parse                  # Parse .osu beatmap -> src/lib/beatmap.json (copies audio/bg/storyboard to public/)
npm run parse -- "keyword"     # Fuzzy search beatmap by keyword
npm run parse:replay           # Parse .osr replay -> src/lib/replay.json
npm run dev                    # Remotion Studio (live preview)
npm run lint                   # ESLint + tsc
npm run build                  # Bundle (runs parse:replay? no - runs `prebuild` which runs parse)
npx remotion render ManiaRender out/video.mp4  # Full render
```

**Critical order**: Run `npm run parse` before build/render. `prebuild` script runs parse automatically on `npm run build`, but not on direct `remotion render` calls.

## Generated Files (gitignored)

- `src/lib/beatmap.json` - parsed beatmap data
- `src/lib/replay.json` - parsed replay data
- `src/lib/storyboard.json` - parsed storyboard data
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

| Path       | Purpose                                                               |
| ---------- | --------------------------------------------------------------------- |
| `cheart/`  | .osu beatmap files (source)                                           |
| `replay/`  | .osr replay files (source)                                            |
| `src/lib/` | Parsed JSON data + parsers (osuParser, osrParser, sbParser, judgment) |
| `scripts/` | CLI parse scripts (parseBeatmap.ts, parseReplay.ts, selectFile.ts)    |
| `public/`  | Runtime assets (audio, images, storyboard)                            |

## Toolchain Notes

- **zod v4** (`zod@4.3.6`) - use `z.object()`, `z.enum()`, `z.infer<>`
- **Tailwind v4** via `@remotion/tailwind-v4` in remotion.config.ts
- **TypeScript**: strict, noEmit, resolves JSON modules (`"resolveJsonModule": true`)
- **ESLint**: uses `@remotion/eslint-config-flat` (flat config in `eslint.config.mjs`)
- **No test framework** - no tests exist
- **Prettier**: 2-space, no tabs, bracketSpacing true

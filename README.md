# osu!mania Map Renderer

A [Remotion](https://remotion.dev) v4 project for rendering osu!mania beatmap videos. Parses `.osu` beatmaps and `.osr` replays, renders full storyboard animations, and outputs high-quality video at 1920×1080 60fps.

Built with React + TypeScript + Tailwind v4 + Zod v4.

## Features

- **Beatmap parsing** — Full `.osu` format support: hit objects, timing points, scroll velocity, hit sounds
- **Replay visualization** — Parse `.osr` files and animate key press bars with judgment-based coloring
- **Storyboard rendering** — Full `.osb` + `[Events]` section support with Sprite/Animation objects and all command types
- **Dynamic key count** — Auto-detected from beatmap, supports 1K–18K+ with proper column positions and colors
- **Multiple judgment modes** — ScoreV1 (classic), ScoreV2 (DifficultyRange), custom hit windows
- **Hitsound system** — Beatmap-specific hitsounds with fallback chains, concurrent playback, volume control
- **Layered rendering** — Background, Stage, Overlay, Replay Cursor — render individually or combined
- **Live preview** — Remotion Studio for interactive timeline scrubbing and parameter tuning

## Quick Start

```bash
# Install dependencies
npm install

# Place(unzip) beatmap(s) in cheart/, replay(s) in replay/
# Parse beatmap (required before first render)
npm run parse

# Or parse by keyword
npm run parse -- "song name"

# Open Remotion Studio for live preview
npm run dev

# Full render to MP4
npx remotion render ManiaRender out/video.mp4
```

## Setup Details

### Beatmap Source

Place `.osu` files in the `cheart/` directory. Multiple beatmap directories are supported:
`cheart/`, `cheart-bliss/`, `cheart-spm/`, `cheart-ttf/`, etc.

### Replay Source

Place `.osr` files in the `replay/` directory.

### Parse

```bash
npm run parse                    # Parse selected .osu beatmap
npm run parse -- "keyword"       # Fuzzy search and parse
npm run parse:replay             # Parse selected .osr replay
npm run parse:replay -- "keyword"
npm run parse:all                # Parse both beatmap and replay
npm run parse:storyboard         # Standalone storyboard parsing
```

Parsing generates:
- `src/generated/beatmap.json` — Parsed beatmap data
- `src/generated/replay.json` — Parsed replay data
- `src/generated/storyboard.json` — Parsed storyboard data
- `public/audio.mp3` — Beatmap audio
- `public/background.jpg` — Background images
- `public/Storyboard/` — Storyboard assets

### Remotion Studio

```bash
npm run dev
```

Opens an interactive preview at `http://localhost:3000`. Select a composition from the sidebar to preview. Each composition supports different prop configurations for the right panel.

### Render

```bash
# Full render (all layers)
npx remotion render ManiaRender out/video.mp4

# Individual layers
npx remotion render ManiaBackground out/bg.mp4
npx remotion render ManiaStageOnly out/stage.mp4
npx remotion render ManiaOverlayOnly out/overlay.mp4
npx remotion render ManiaReplayCursorOnly out/cursor.mp4
```

**Note:** `npm run build` runs `prebuild` (auto-parses beatmap), but direct `npx remotion render` calls do not. If you haven't parsed yet, run `npm run parse` first.

## Architecture

### Layer Pipeline (back to front)

```
┌─────────────────────────────────────────────────┐
│  Layer 1: ManiaBackground                       │
│  ├── Background image (adjustable blur/darken)  │
│  └── Storyboard layers (Bg/Fail/Pass/Fg/Overlay)│
├─────────────────────────────────────────────────┤
│  Layer 2: ManiaStageLayer                       │
│  ├── Beat lines / Bar lines                     │
│  ├── Notes (regular + long notes)               │
│  ├── Judgment line                              │
│  ├── Key press indicators                       │
│  ├── Column highlights                          │
│  ├── Hit effects (column flash + note flash)    │
│  └── Replay cursor (falling bars + dots)        │
├─────────────────────────────────────────────────┤
│  Layer 3: ManiaOverlay                          │
│  ├── Metadata (title, artist, creator, diff)    │
│  ├── Score, combo, max combo                    │
│  ├── Real-time PP calculation                   │
│  ├── Judgment statistics (P/G/GO/O/M/Miss)      │
│  ├── Last judgment text animation               │
│  └── Hit offset indicator visualization         │
└─────────────────────────────────────────────────┘
```

### Compositions

All compositions are 1920×1080 @ 60fps, duration derived from beatmap length + beat offset.

| ID | Description | Schema |
|----|-------------|--------|
| `ManiaRender` | Full render: all layers combined | Full `maniaRenderSchema` |
| `ManiaBackground` | Background image + storyboard only | Full schema |
| `ManiaStageOnly` | Stage layer only (notes, key presses, hits) | Full schema |
| `ManiaOverlayOnly` | Overlay layer only (score, combo, PP) | No schema (fixed) |
| `ManiaReplayCursorOnly` | Replay cursor bars only | Full schema |

### Props Schema (Zod v4)

Props are defined in `src/schema.ts` with nested zod objects and defaults:

```
{
  time:     { beatOffset: number, timeOffset: number },
  scroll:   { scrollSpeed: 5–50, default: 20 },
  judgment: { mode: "v1"|"v2"|"custom", offset, showZones, customWindows? },
  layout:   { stageOffset, judgmentLineY: 100–1000, judgmentTextY: 0–1080 },
  contents: {
    trackHeight, columnHighlights, replayCursor, sessionLine,
    storyboardEnabled, bgDarken, bgBlur, stageBgOpacity,
    hitsounds: { enabled, trigger: "auto"|"manual", volume },
    hitOffsetIndicator: { enabled, x, y, width, height, timeWindow, ... }
  }
}
```

### Data Flow

```
cheart/*.osu ──[parseBeatmap.ts]──▶ src/generated/beatmap.json  ──import──▶ React components
replay/*.osr  ──[parseReplay.ts]──▶  src/generated/replay.json   ──import──▶ React components
*.osb + [Events] ──[sbParser]──▶   src/generated/storyboard.json ──import──▶ StoryboardLayer.tsx
```

## Configuration

### Judgment Modes

| Mode | Description | Formula |
|------|-------------|---------|
| `v1` (Classic) | ScoreV1 hit windows | `base[OD] + 3 × (10 − OD)` for each judgment tier |
| `v2` (ScoreV2) | ScoreV2 DifficultyRange | Matches osu! client behavior |
| `custom` | User-defined | Explicit ms values via `customWindows` prop |

### Key Count

Auto-detected from `BeatmapDifficulty.CircleSize` at module load. All column positions, widths, and colors are computed dynamically via `setKeyCount()`. Supported range: 1K–18K+.

### Storyboard

Full support including:
- **Objects**: Sprite, Animation (with frame delay + loop type), Video
- **Layers**: Background, Fail, Pass, Foreground, Overlay (with Pass/Fail visibility)
- **Commands**: F (Fade), M/MX/MY (Move), S (Scale), V (Vector Scale), R (Rotate), C (Color), P (Parameter: H/V/A)
- **Loops**: Nested L commands with iteration timing
- **Easing**: All 35 osu! easing functions (0–34)
- **Features**: Variable substitution (`$var`), shorthand syntax, widescreen support
- **Color mixing**: Linear-space sRGB conversion for gamma-correct blending via SVG `feColorMatrix`

### Hitsounds

Automatic playback of beatmap hitsounds with:
- File fallback chain (specific → soft → normal sample sets)
- Concurrent playback support
- Volume control per beatmap
- Normal vs Long Note hitsound separation

## Project Structure

```
src/
├── components/stage/         ← Stage sub-components (BeatLines, HitEffects, etc.)
├── config.ts                   ← Dynamic key count, column positions, colors
├── schema.ts                   ← Zod schemas for composition props
├── Root.tsx                    ← Composition registry (5 compositions)
├── ManiaRender.tsx             ← Full render orchestrator
├── ManiaBackground.tsx         ← Background layer (bg image + storyboard)
├── ManiaStageLayer.tsx         ← Stage layer (notes, key presses, effects, replays)
├── ManiaStageSubComponents.tsx ← Re-exports from components/stage/
├── ManiaNote.tsx               ← Single note component (regular + long notes)
├── ManiaOverlay.tsx            ← Overlay layer (score, combo, PP, metadata)
├── ReplayCursor.tsx            ← Replay cursor bar/dot renderer
├── ReplayCursorLayer.tsx       ← Replay cursor layer wrapper
├── HitOffsetIndicator.tsx      ← Hit offset visualization
├── lib/
│   ├── osuParser.ts            ← Beatmap data types + JSON import
│   ├── osrParser.ts            ← .osr binary parser (LZMA decompression)
│   ├── sbParser/               ← Storyboard parser (types, parser)
│   │   ├── types.ts, parser.ts, index.ts
│   ├── storyboard/             ← Storyboard runtime evaluator
│   │   ├── command-evaluator.ts  ← Command interpolation & priority
│   │   ├── loop-evaluator.ts     ← Loop iteration timing
│   │   ├── easing.ts             ← 35 easing functions
│   │   ├── visibility.ts         ← Sprite lifetime calculations
│   ├── StoryboardLayer.tsx     ← Storyboard React renderer (SVG color filters)
│   ├── judgment.ts             ← Hit window calculation & judgment matching
│   ├── difficulty.ts           ← Star rating & PP calculator
│   ├── scrollVelocity.ts       ← Timing point → scroll speed conversion
│   ├── hitsound.ts             ← Hitsound manager (concurrency, fallback)
│   ├── replay.ts               ← Replay data loader
│   └── __tests__/              ← Unit tests (Vitest)
├── generated/                  ← Auto-generated JSON (gitignored)
└── index.ts                    ← Remotion entry point (registerRoot)

scripts/
├── parseBeatmap.ts             ← Main beatmap parser
├── parseReplay.ts              ← Replay parser
├── parseAll.ts                 ← Batch parse
├── parseStoryboard.ts          ← Standalone storyboard parser
├── selectFile.ts               ← File selection & fuzzy search
└── __tests__/                  ← Script tests
```

## Development

### Testing

```bash
npm run test          # Run all unit tests (Vitest)
npm run lint          # ESLint + TypeScript check
```

654 unit tests covering:
- Command evaluation (F, M, S, V, R, C, P types)
- Loop timing and priority
- Easing functions (all 35)
- Sprite visibility lifetimes
- Animation frame calculation
- Color filter ID generation
- Judgment windows
- Beatmap parser
- Replay parser (LZMA decompression)
- Storyboard parser
- Scroll velocity algorithms
- Difficulty calculation

### Technical Notes

- **Tailwind v4**: Enabled via `@remotion/tailwind-v4` in `remotion.config.ts`
- **TypeScript**: Strict mode, `noEmit`, `resolveJsonModule`
- **ESLint**: Flat config via `@remotion/eslint-config-flat`
- **Vitest**: Fast parallel test runner
- **Config file**: `src/config.ts` uses module-level mutable `let` exports updated by `setKeyCount()`

## Reference

- **[OSU-SBDOC.md](./OSU-SBDOC.md)** — Chinese translation of official osu! storyboarding specs
- **Original osu! source** (`~/Projects/osu/`) — Reference for behavior verification
- **Parsed JSON outputs** (`src/generated/`) — Debug storyboard and beatmap data

## License

UNLICENSED — Private project.

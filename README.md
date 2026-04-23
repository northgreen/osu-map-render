# osu!mania Map Renderer

A Remotion v4 project for rendering osu!mania beatmap videos with storyboard support.

## Features

- Beatmap parsing from `.osu` files
- Replay playback visualization from `.osr` files
- Full storyboard rendering (`.osb` + `[Events]` section)
- Dynamic key count support (1K-18K+)
- Multiple judgment modes (v1, v2, custom)
- Layered rendering (Background, Stage, Overlay, Replay Cursor)

## Commands

```console
npm run dev                          # Start Remotion Studio (live preview)
npm run build                        # Bundle the project
npm run lint                         # Run ESLint + TypeScript
npm run parse                        # Parse beatmap to JSON + copy assets
npm run parse -- "keyword"           # Parse beatmap matching keyword (fuzzy search)
npm run parse:replay                 # Parse .osr replay file to JSON
npm run parse:replay -- "keyword"    # Parse replay matching keyword (fuzzy search)
npm run parse:storyboard             # Parse storyboard.osb to JSON (standalone)
npx remotion render ManiaRender out/video.mp4    # Render full osu!mania video
npx remotion render ManiaBackground out/video.mp4   # Background layer only
npx remotion render ManiaStageOnly out/video.mp4    # Stage layer only
npx remotion render ManiaOverlayOnly out/video.mp4  # Overlay only
```

## Setup

### Beatmap Source

Place `.osu` beatmap files in the `cheart/` folder.

### Replay Source

Place `.osr` replay files in the `replay/` folder.

### Parse Beatmap

```console
npm run parse
```

This will:
1. Parse the beatmap to `src/lib/beatmap.json`
2. Copy audio to `public/audio.mp3`
3. Copy background images to `public/`
4. Copy storyboard assets to `public/Storyboard/`
5. Parse and merge storyboard (`.osb` + `.osu` events) to `src/lib/storyboard.json`

### Parse Replay

```console
npm run parse:replay
```

This will parse the replay to `src/lib/replay.json`.

## Architecture

### Layer Structure (back to front)

1. **Background** - Background image + storyboard layers (Background, Fail, Pass, Foreground, Overlay)
2. **Stage** - Beat lines, notes, judgment line, column dividers, key press indicators, hit effects
3. **Overlay** - Metadata, score, combo, PP, judgment stats
4. **Replay Cursor** - Falling key press/release bars colored by judgment

### Composition IDs

- `ManiaRender` - Full render (all layers combined)
- `ManiaBackground` - Background + storyboard only
- `ManiaStageOnly` - Stage (notes, judgment line, key presses, hit effects)
- `ManiaOverlayOnly` - Overlay (score, combo, PP, metadata)
- `ManiaReplayCursorOnly` - Replay cursor falling bars only

### Data Flow

```
cheart/*.osu ──parse──▶ src/lib/beatmap.json ──import──▶ Rendering
replay/*.osr ──parse──▶ src/lib/replay.json  ──import──▶ Rendering
storyboard.osb ──parse──▶ src/lib/storyboard.json ──import▶ Rendering
```

## Configuration

### Judgment Modes

- **v1** - Classic ScoreV1 hit windows
- **v2** - ScoreV2 hit windows
- **custom** - User-defined hit windows

### Key Count

Auto-detected from beatmap's `CircleSize` property. Supports 1K through 18K+.

### Scroll Speed

Adjustable via composition props (5-50, default: 20).

## Storyboard

The storyboard renderer supports:
- Sprite and Animation objects
- All 5 layers (Background, Fail, Pass, Foreground, Overlay)
- Commands: F (Fade), M/MX/MY (Move), S (Scale), V (Vector Scale), R (Rotate), C (Color), P (Parameter)
- Loop (L) and Trigger (T) commands with nested children
- All 35 osu! easing functions
- Variable substitution ($VAR)
- Widescreen storyboard (16:9 aspect ratio)

## Reference

- [osu! source code](~/Projects/osu/) - For storyboard behavior and judgment algorithms
- [OSU-SBDOC.md](./OSU-SBDOC.md) - osu! storyboarding specifications

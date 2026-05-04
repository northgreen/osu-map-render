import { useMemo } from "react";
import { Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Layer, SbSample } from "./sbParser/types";
import { availableHitsoundFiles } from "./hitsoundFiles";

export interface StoryboardAudioLayerProps {
  samples: SbSample[];
  isFailing: boolean;
  /** When set, bypass fail/pass filtering and show only this layer (or "all") */
  manualLayer?: "all" | Layer;
}

const MAX_STORYBOARD_AUDIO_CONCURRENT = 10;
const DEFAULT_SAMPLE_DURATION_MS = 1000;

interface SampleMeta {
  key: string;
  sampleFrame: number;
  durationFrames: number;
  path: string;
  volume: number;
}

function isLayerVisible(
  layer: Layer,
  isFailing: boolean,
  manualLayer?: "all" | Layer,
): boolean {
  // manualLayer override takes precedence
  if (manualLayer === "all") return true;
  if (manualLayer !== undefined) return layer === manualLayer;

  // osu! layer visibility rules
  switch (layer) {
    case "Background":
    case "Foreground":
    case "Overlay":
      return true;
    case "Fail":
      return isFailing;
    case "Pass":
      return !isFailing;
  }
}

export const StoryboardAudioLayer: React.FC<StoryboardAudioLayerProps> = ({
  samples,
  isFailing,
  manualLayer,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Pre-compute metadata for all visible samples (across all time).
  // Only re-runs when samples, visibility state, or fps changes — not every frame.
  const sampleMeta = useMemo<SampleMeta[]>(() => {
    const result: SampleMeta[] = [];

    for (const sample of samples) {
      // Skip samples whose audio files aren't in public/
      if (!availableHitsoundFiles.has(sample.path)) continue;

      // Check layer visibility
      if (!isLayerVisible(sample.layer, isFailing, manualLayer)) continue;

      const sampleFrame = Math.round((sample.time / 1000) * fps);
      const durationMs = sample.duration ?? DEFAULT_SAMPLE_DURATION_MS;
      const durationFrames = Math.ceil((durationMs / 1000) * fps);
      const volume = Math.min(Math.max(sample.volume / 100, 0), 1);

      result.push({
        key: `${sample.id}-${sample.time}`,
        sampleFrame,
        durationFrames,
        path: sample.path,
        volume,
      });
    }

    return result;
  }, [samples, isFailing, manualLayer, fps]);

  // Filter to currently active samples based on current frame.
  // This lightweight filter runs every frame, while the expensive layer
  // visibility computation stays cached.
  const activeSamples = useMemo(() => {
    if (sampleMeta.length === 0) return null;

    const elements: React.ReactNode[] = [];
    let count = 0;

    for (const meta of sampleMeta) {
      if (frame >= meta.sampleFrame && frame < meta.sampleFrame + meta.durationFrames) {
        elements.push(
          <Sequence key={meta.key} from={meta.sampleFrame} durationInFrames={meta.durationFrames}>
            <Audio
              src={staticFile(meta.path)}
              volume={() => meta.volume}
            />
          </Sequence>,
        );
        if (++count >= MAX_STORYBOARD_AUDIO_CONCURRENT) break;
      }
    }

    return elements.length > 0 ? elements : null;
  }, [frame, sampleMeta]);

  return <>{activeSamples}</>;
};

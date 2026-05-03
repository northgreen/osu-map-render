import { useMemo } from "react";
import { SequentialScrollAlgorithm } from "../../lib/scrollVelocity";
import { ParsedBeatmap } from "../../lib/osuParser";
import { getHitWindows } from "../../lib/judgment";
import {
  NOTE_WIDTH,
  config,
} from "../../config";

// ============================================
// JudgmentZonesLayer
// ============================================

/** Props for the judgment zones rendering layer */
export interface JudgmentZonesLayerProps {
  /** Hit objects to render zones for */
  hitObjects: ParsedBeatmap["hitObjects"];
  /** Current playback time in milliseconds */
  currentTime: number;
  /** Visible time window in milliseconds */
  visibleTime: number;
  /** Y position of the judgment line in pixels */
  judgmentY: number;
  /** Left edge of the stage in pixels (STAGE_X + stageOffset) */
  stageX: number;
  /** Parsed beatmap (for difficulty/OD) */
  beatmap: ParsedBeatmap;
  /** Scroll velocity algorithm (nullable) */
  scrollAlgorithm: SequentialScrollAlgorithm | null;
}

/**
 * Render judgment zone rectangles — colored overlays showing hit windows
 * around each note. Zones extend upward (early) and downward (late) from
 * the note position, with colors progressing from magenta (perfect) to
 * red (meh).
 */
export const JudgmentZonesLayer: React.FC<JudgmentZonesLayerProps> = ({
  hitObjects,
  currentTime,
  visibleTime,
  judgmentY,
  stageX,
  beatmap,
  scrollAlgorithm,
}) => {
  const od = beatmap.difficulty.overallDifficulty;
  const windows = getHitWindows(od);

  const zoneColors = [
    {
      color: "rgba(255, 0, 255, 0.3)",
      borderColor: "rgba(255, 0, 255, 0.8)",
      window: windows.perfect,
    },
    {
      color: "rgba(0, 255, 136, 0.25)",
      borderColor: "rgba(0, 255, 136, 0.6)",
      window: windows.great,
    },
    {
      color: "rgba(0, 170, 255, 0.2)",
      borderColor: "rgba(0, 170, 255, 0.5)",
      window: windows.good,
    },
    {
      color: "rgba(255, 170, 0, 0.15)",
      borderColor: "rgba(255, 170, 0, 0.4)",
      window: windows.ok,
    },
    {
      color: "rgba(255, 68, 68, 0.12)",
      borderColor: "rgba(255, 68, 68, 0.3)",
      window: windows.meh,
    },
  ];

  const msToPixels = useMemo(
    () => (ms: number) => {
      if (visibleTime <= 0 || Number.isNaN(ms)) return 0;
      return (ms / visibleTime) * judgmentY;
    },
    [visibleTime, judgmentY],
  );

  return (
    <>
      {hitObjects.map((note, index) => {
        const timeUntilHit = note.time - currentTime;
        if (timeUntilHit > visibleTime || timeUntilHit < -200) return null;

        const progress = scrollAlgorithm
          ? scrollAlgorithm.getProgress(note.time, currentTime)
          : 1 - timeUntilHit / visibleTime;
        const noteY = progress * judgmentY;
        if (Number.isNaN(noteY)) return null;

        const column = Math.min(
          note.column,
          config.columnPositionsNote.length - 1,
        );
        const posX = stageX + config.columnPositionsNote[column];

        let zoneTop = noteY;
        return (
          <div key={`note-zones-${note.time}-${note.column}-${index}`}>
            {zoneColors.map((zone, zoneIndex) => {
              const zoneHeight = msToPixels(zone.window);
              if (zoneHeight <= 0) return null;

              const fadeStart = 100;
              const opacity = Math.min(
                1,
                Math.max(0.1, (zoneTop - fadeStart) / fadeStart + 1),
              );

              const currentTop = zoneTop - zoneHeight;
              zoneTop -= zoneHeight;

              return (
                <div
                  key={`zone-early-${note.time}-${note.column}-${index}-${zoneIndex}`}
                  className={`judgment-zone zone-${zoneIndex}`}
                  style={{
                    left: posX + 2,
                    top: currentTop,
                    width: NOTE_WIDTH - 4,
                    height: zoneHeight - 1,
                    opacity,
                  }}
                />
              );
            })}
            {zoneColors.map((zone, zoneIndex) => {
              const zoneHeight = msToPixels(zone.window);
              if (zoneHeight <= 0) return null;

              const startY =
                noteY +
                msToPixels(
                  zoneColors
                    .slice(0, zoneIndex)
                    .reduce((sum, z) => sum + msToPixels(z.window), 0),
                );
              const opacity = Math.min(
                1,
                Math.max(0.1, (startY - 100) / 100 + 1),
              );

              return (
                <div
                  key={`zone-late-${note.time}-${note.column}-${index}-${zoneIndex}`}
                  className={`judgment-zone zone-${zoneIndex}`}
                  style={{
                    left: posX + 2,
                    top: startY,
                    width: NOTE_WIDTH - 4,
                    height: zoneHeight - 1,
                    opacity,
                  }}
                />
              );
            })}
          </div>
        );
      })}
    </>
  );
};

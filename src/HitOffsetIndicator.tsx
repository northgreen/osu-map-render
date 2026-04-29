import { useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo } from "react";
import { ParsedBeatmap } from "./lib/osuParser";
import {
  getRecentHitOffsets,
  getJudgmentColor,
  getHitWindows,
} from "./lib/judgment";

interface HitOffsetIndicatorProps {
  beatmap?: ParsedBeatmap;
  enabled?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  timeWindow?: number;
  maxHits?: number; // 0 = unlimited
  maxOffset?: number;
  showCenterLine?: boolean;
  showLabels?: boolean;
}

export const HitOffsetIndicator: React.FC<HitOffsetIndicatorProps> = ({
  beatmap,
  enabled = false,
  x = 0,
  y = 540,
  width = 600,
  height = 30,
  timeWindow = 3000,
  maxHits = 0,
  maxOffset = 0,
  showCenterLine = true,
  showLabels = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = (frame / fps) * 1000;

  // Get hit offsets within time window
  const hitOffsets = useMemo(() => {
    if (!beatmap) return [];
    let offsets = getRecentHitOffsets(
      beatmap.hitObjects,
      beatmap.difficulty.overallDifficulty,
      currentTime,
      timeWindow,
    );
    // Note: getRecentHitOffsets returns results sorted by hitTime ascending
    // (oldest first, latest last) - relied upon by isLatest logic below

    // Apply maxHits limit if specified
    if (maxHits > 0 && offsets.length > maxHits) {
      offsets = offsets.slice(-maxHits); // Keep only the most recent N hits
    }

    return offsets;
  }, [beatmap, currentTime, timeWindow, maxHits]);

  // Calculate effective maxOffset (auto from OD if not specified)
  const effectiveMaxOffset = useMemo(() => {
    if (maxOffset > 0) return maxOffset;
    if (!beatmap) return 200;
    const windows = getHitWindows(beatmap.difficulty.overallDifficulty);
    return windows.meh * 1.2; // meh window + 20% margin
  }, [beatmap, maxOffset]);

  if (!enabled || !beatmap) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: `calc(50% + ${x}px)`,
        top: y,
        width,
        height,
        transform: "translateX(-50%)",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      {/* Center line */}
      {showCenterLine && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            width: 2,
            height,
            backgroundColor: "rgba(255, 255, 255, 0.8)",
            transform: "translateX(-50%)",
          }}
        />
      )}

      {/* Hit offset dots */}
      {hitOffsets.map((hit, index) => {
        const normalizedOffset = Math.max(
          -1,
          Math.min(1, hit.offset / effectiveMaxOffset),
        );
        const pixelX = normalizedOffset * (width / 2);
        const color = getJudgmentColor(hit.judgment);
        const isLatest = index === hitOffsets.length - 1;

        // Results are sorted by hitTime ascending (oldest first, latest last)
        const baseOpacity = isLatest ? 1 : 0.4;
        const recencyFactor = index / Math.max(1, hitOffsets.length - 1); // 0=oldest, 1=latest-1
        const opacity = isLatest ? 1 : baseOpacity + (0.5 * recencyFactor); // oldest=0.4, latest-1=0.9

        return (
          <div
            key={`${hit.time}-${hit.column}-${hit.judgment}`}
            style={{
              position: "absolute",
              left: `calc(50% + ${pixelX}px)`,
              top: "50%",
              width: isLatest ? 14 : 10,
              height: isLatest ? 14 : 10,
              borderRadius: "50%",
              backgroundColor: color,
              boxShadow: isLatest
                ? `0 0 15px ${color}`
                : `0 0 5px ${color}`,
              transform: "translate(-50%, -50%)",
              opacity,
              zIndex: isLatest ? 10 : 1,
            }}
          />
        );
      })}

      {/* Labels */}
      {showLabels && (
        <>
          <div
            style={{
              position: "absolute",
              left: 8,
              top: -20,
              fontSize: 12,
              color: "rgba(255, 255, 255, 0.7)",
            }}
          >
            Early
          </div>
          <div
            style={{
              position: "absolute",
              right: 8,
              top: -20,
              fontSize: 12,
              color: "rgba(255, 255, 255, 0.7)",
            }}
          >
            Late
          </div>
        </>
      )}
    </div>
  );
};

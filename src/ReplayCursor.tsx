import React, { useMemo } from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { replay } from "./lib/replay";
import type { SequentialScrollAlgorithm } from "./lib/scrollVelocity";
import { getKeyIntervals, getJudgmentResults, getJudgmentColor } from "./lib/judgment";
import { beatmap } from "./lib/osuParser";
import { bisectRight } from "./lib/utils";
import {
  SCROLL_SPEED as DEFAULT_SCROLL_SPEED,
  BASE_VISIBLE_TIME,
  NOTE_HEIGHT,
  JUDGMENT_LINE_Y,
  STAGE_X,
  config,
} from "./config";

function getVisibleTime(scrollSpeed: number): number {
  return BASE_VISIBLE_TIME * (10 / scrollSpeed);
}

interface ReplayCursorProps {
  scrollSpeed?: number;
  scrollAlgorithm?: SequentialScrollAlgorithm | null;
  stageOffset?: number;
  judgmentLineY?: number;
}

export const ReplayCursor: React.FC<ReplayCursorProps> = React.memo(
  ({
    scrollSpeed = DEFAULT_SCROLL_SPEED,
    scrollAlgorithm = null,
    stageOffset = 0,
    judgmentLineY: jy = JUDGMENT_LINE_Y,
  }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const currentTime = (frame / fps) * 1000;

    const VISIBLE_TIME = getVisibleTime(scrollSpeed);
    const keyIntervals = getKeyIntervals();

    // Pre-compute interval start times for binary search
    const startTimes = useMemo(
      () => keyIntervals.map((i) => i.start),
      [keyIntervals],
    );

    // Get judgment results for coloring (cached internally, cheap)
    const judgments = getJudgmentResults(
      beatmap?.hitObjects || [],
      beatmap?.difficulty?.overallDifficulty || 7.5,
    );

    // Pre-compute interval-to-judgment color mapping (avoids O(V×J) per frame)
    const intervalColorMap = useMemo(() => {
      const map = new Map<
        string,
        { headColor: string; tailColor: string; isLN: boolean }
      >();

      for (const interval of keyIntervals) {
        let headColor = config.columnColors[interval.column];
        let tailColor = config.columnColors[interval.column];
        let isLN = false;

        for (const j of judgments) {
          if (
            j.column === interval.column &&
            Math.abs(j.noteTime - interval.start) < 50
          ) {
            headColor = getJudgmentColor(j.judgment);
            isLN = j.isLongNote;
          }
          if (
            j.column === interval.column &&
            j.isLongNote &&
            j.endTime &&
            Math.abs(j.noteTime - interval.end) < 50
          ) {
            tailColor = getJudgmentColor(j.judgment);
          }
        }

        map.set(`${interval.column}:${interval.start}`, {
          headColor,
          tailColor,
          isLN,
        });
      }

      return map;
    }, [keyIntervals, judgments]);

    // Early return after all hooks for React consistency
    if (!replay?.replayData || replay.replayData.length === 0) {
      return null;
    }

    const cursors: React.JSX.Element[] = [];

    // Use bisectRight to find visible window start/end (avoids full scan)
    const visibleStart = currentTime - 200;
    const visibleEnd = currentTime + VISIBLE_TIME;

    // Right boundary: find last index where startTime <= visibleEnd
    const intervalEndIdx = bisectRight(startTimes, visibleEnd);

    // Left boundary: find first index where startTime >= visibleStart
    // bisectRight returns rightmost index where startTime <= visibleStart-0.001 (or -1)
    const leftByStart = bisectRight(startTimes, visibleStart - 0.001) + 1;

    // Expand leftwards to include intervals whose end is still within the visible window
    let intervalStartIdx = leftByStart;
    for (let i = leftByStart - 1; i >= 0; i--) {
      if (keyIntervals[i].end >= visibleStart) {
        intervalStartIdx = i;
      }
    }

    for (
      let i = intervalStartIdx;
      i <= intervalEndIdx && i < keyIntervals.length;
      i++
    ) {
      const interval = keyIntervals[i];

      // Calculate progress for start and end times
      const startProgress = scrollAlgorithm
        ? scrollAlgorithm.getProgress(interval.start, currentTime)
        : 1 - (interval.start - currentTime) / VISIBLE_TIME;
      const endProgress = scrollAlgorithm
        ? scrollAlgorithm.getProgress(interval.end, currentTime)
        : 1 - (interval.end - currentTime) / VISIBLE_TIME;

      // Calculate Y positions
      const clampedStartProgress = Math.max(0, Math.min(1, startProgress));
      const clampedEndProgress = Math.max(0, Math.min(1, endProgress));

      const startY = interpolate(
        clampedStartProgress,
        [0, 1],
        [-NOTE_HEIGHT, jy],
      );
      const endY = interpolate(clampedEndProgress, [0, 1], [-NOTE_HEIGHT, jy]);

      // Skip if the rendered height would be negative or too small
      const height = Math.abs(startY - endY);
      if (height < 2) continue;

      const posX = config.columnPositionsStage[interval.column];

      // O(1) Map lookup for judgment colors (replaces nested O(V×J) loop)
      const colors = intervalColorMap.get(
        `${interval.column}:${interval.start}`,
      );
      const headJudgmentColor =
        colors?.headColor ?? config.columnColors[interval.column];
      const tailJudgmentColor =
        colors?.tailColor ?? config.columnColors[interval.column];
      const isLN = colors?.isLN ?? false;

      const barColor = headJudgmentColor;

      // Main bar
      cursors.push(
        <div
          key={`key-bar-${i}`}
          style={{
            position: "absolute",
            left: STAGE_X + stageOffset + posX - 15,
            top: Math.min(startY, endY),
            width: 30,
            height: height,
            backgroundColor: barColor,
            opacity: 0.4,
            borderRadius: 50,
            border: `2px solid ${barColor}`,
            boxShadow: `0 0 10px ${barColor}`,
            pointerEvents: "none",
            zIndex: 100,
          }}
        />,
      );

      // Circle at start (key press) - always show for both single notes and LN
      cursors.push(
        <div
          key={`key-start-${i}`}
          style={{
            position: "absolute",
            left: STAGE_X + stageOffset + posX - 12,
            top: startY - 12,
            width: 24,
            height: 24,
            borderRadius: "50%",
            backgroundColor: headJudgmentColor,
            border: "3px solid white",
            boxShadow: `0 0 15px ${headJudgmentColor}`,
            pointerEvents: "none",
            zIndex: 101,
          }}
        />,
      );

      // Circle at end (key release) - only show for LN (long notes)
      if (isLN) {
        cursors.push(
          <div
            key={`key-end-${i}`}
            style={{
              position: "absolute",
              left: STAGE_X + stageOffset + posX - 12,
              top: endY - 12,
              width: 24,
              height: 24,
              borderRadius: "50%",
              backgroundColor: tailJudgmentColor,
              border: "3px solid white",
              boxShadow: `0 0 15px ${tailJudgmentColor}`,
              pointerEvents: "none",
              zIndex: 101,
            }}
          />,
        );
      }
    }

    return <>{cursors}</>;
  },
);

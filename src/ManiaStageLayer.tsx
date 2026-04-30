import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo } from "react";
import { ParsedBeatmap, TimingPoint } from "./lib/osuParser";
import { ManiaNote } from "./ManiaNote";
import { ReplayCursor } from "./ReplayCursor";
import { SequentialScrollAlgorithm } from "./lib/scrollVelocity";
import { replay } from "./lib/replay";
import { isAutoplayMode, getKeyIntervals } from "./lib/judgment";
import { hitsoundManager } from "./lib/hitsound";
import {
  SCROLL_SPEED as DEFAULT_SCROLL_SPEED,
  STAGE_X,
  JUDGMENT_LINE_Y,
  config,
  getKeyCount,
  type HitsoundsConfig,
} from "./config";
import {
  BeatLinesLayer,
  JudgmentZonesLayer,
  KeyIndicatorsLayer,
  ColumnHighlightsLayer,
  HitEffectsLayer,
} from "./ManiaStageSubComponents";

interface ManiaStageLayerProps {
  beatmap?: ParsedBeatmap;
  scrollSpeed?: number;
  beatOffset?: number;
  showJudgmentZones?: boolean;
  stageOffset?: number;
  judgmentLineY?: number;
  showReplayCursor?: boolean;
  showJudgmentLine?: boolean;
  showBeatLines?: boolean;
  showColumnHighlights?: boolean;
  stageBgOpacity?: number;
  hitsounds?: HitsoundsConfig;
}

// Generate beat lines based on timing points
function generateBeatLines(
  timingPoints: TimingPoint[],
  durationMs: number,
): number[] {
  const beatLines: number[] = [];
  if (timingPoints.length === 0) return beatLines;

  const uninheritedPoints = timingPoints.filter((tp) => tp.uninherited);
  if (uninheritedPoints.length === 0) return beatLines;

  // Start from the earliest timing point and go backwards to cover the beginning
  const firstTp = uninheritedPoints[0];
  const msPerBeat = Math.abs(firstTp.beatLength);

  // Generate beat lines from time 0 to the first timing point
  for (let time = 0; time < firstTp.time; time += msPerBeat) {
    if (time > 0) beatLines.push(time);
  }

  // Then generate beat lines from first timing point onwards
  for (let i = 0; i < uninheritedPoints.length; i++) {
    const tp = uninheritedPoints[i];
    const nextTp = uninheritedPoints[i + 1];
    const endTime = nextTp ? nextTp.time : durationMs + 5000;

    const beatLength = Math.abs(tp.beatLength);

    for (let time = tp.time; time < endTime; time += beatLength) {
      if (time > firstTp.time) beatLines.push(time); // Avoid duplicates
    }
  }

  return beatLines;
}

export const ManiaStageLayer: React.FC<ManiaStageLayerProps> = ({
  beatmap,
  scrollSpeed = DEFAULT_SCROLL_SPEED,
  beatOffset = 0,
  showJudgmentZones = false,
  stageOffset = 0,
  judgmentLineY = JUDGMENT_LINE_Y,
  showReplayCursor = true,
  showJudgmentLine = true,
  showBeatLines = true,
  showColumnHighlights = true,
  stageBgOpacity = 1,
  hitsounds = { enabled: false, trigger: "auto", volume: 1.0 },
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Handle missing beatmap - return placeholder (all hooks above this line)
  const { hitObjects, timingPoints } = beatmap || {
    hitObjects: [],
    timingPoints: [],
  };
  const currentTime = beatmap ? (frame / fps) * 1000 : 0;

  // Pre-compute all hitsounds: frame -> HitsoundInfo[]
  // This runs ONCE when beatmap/hitsounds config changes, not every frame
  const hitsoundMap = useMemo(() => {
    if (!hitsounds.enabled || hitsounds.trigger !== "auto") {
      return new Map<number, { id: string; filename: string; volume: number }[]>();
    }

    const map = new Map<number, { id: string; filename: string; volume: number }[]>();

    for (const note of hitObjects) {
      const noteFrame = Math.round((note.time / 1000) * fps);

      const infos = hitsoundManager.getHitsoundsForNote(
        note,
        timingPoints.find((tp) => tp.time <= note.time),
        hitsounds.volume,
      );

      if (infos.length === 0) continue;

      const existing = map.get(noteFrame) || [];
      for (const info of infos) {
        existing.push({
          id: `${note.time}-${note.column}-${info.filename}`,
          filename: info.filename,
          volume: info.volume,
        });
      }
      map.set(noteFrame, existing);
    }

    return map;
  }, [hitObjects, timingPoints, hitsounds, fps]);

  // Per-frame lookup: O(1)
  const currentHitsounds = hitsoundMap.get(frame) || [];

  const durationMs =
    hitObjects.length > 0
      ? (hitObjects[hitObjects.length - 1].endTime ||
          hitObjects[hitObjects.length - 1].time) + 5000
      : 60000;

  // Calculate visible time based on AR and scroll speed - use consistent BASE_VISIBLE_TIME
  const baseVisibleTime = 1800; // Same as config.ts BASE_VISIBLE_TIME
  const visibleTime = baseVisibleTime * (10 / scrollSpeed);

  const scrollAlgorithm = useMemo(() => {
    const svSegments = beatmap?.scrollVelocitySegments;
    if (svSegments && svSegments.length > 0) {
      return new SequentialScrollAlgorithm(svSegments, visibleTime);
    }
    return null;
  }, [beatmap?.scrollVelocitySegments, visibleTime]);

  // Compute actual positions with offsets
  const stageX = STAGE_X + stageOffset;
  const judgmentY = judgmentLineY;

  // Set CSS variables for stage positioning
  const stageStyle = {
    "--stage-x": `${stageX}px`,
    "--stage-width": `${config.stageWidth}px`,
  } as React.CSSProperties;

  // Generate beat lines (memoized - static data)
  const beatLines = useMemo(
    () => generateBeatLines(timingPoints, durationMs),
    [timingPoints, durationMs],
  );

  // Cache cumulative times array (computed once)
  const cumulativeTimes = useMemo(() => {
    if (!replay?.replayData) return [];
    const times: number[] = [];
    let cumulativeTime = 0;
    for (let i = 0; i < replay.replayData.length; i++) {
      cumulativeTime += replay.replayData[i].timeOffset;
      times.push(cumulativeTime);
    }
    return times;
  }, []);

  // Binary search helper: find rightmost index where arr[i] <= value
  function bisectRight(arr: number[], value: number): number {
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (arr[mid] <= value) lo = mid + 1;
      else hi = mid;
    }
    return lo - 1;
  }

  // Get key state: returns both pressedKeys and releaseTimes in a single pass
  const { pressedKeys, releaseTimes } = useMemo(() => {
    const keyCount = getKeyCount();
    const pressedColumns = new Array(keyCount).fill(false) as boolean[];
    const releaseTimeArray = new Array(keyCount).fill(0) as number[];

    if (isAutoplayMode()) {
      // Autoplay: use key intervals from judgment module
      const intervals = getKeyIntervals(hitObjects);
      const keyState = new Array(keyCount).fill(false) as boolean[];

      // Sort intervals by start time
      const sortedIntervals = [...intervals].sort((a, b) => a.start - b.start);

      for (const interval of sortedIntervals) {
        if (interval.start > currentTime) break;

        const col = interval.column;
        if (interval.end <= currentTime) {
          // Key was released
          if (keyState[col]) {
            releaseTimeArray[col] = interval.end;
            keyState[col] = false;
          }
        } else if (interval.start <= currentTime) {
          // Key is currently pressed
          pressedColumns[col] = true;
          keyState[col] = true;
        }
      }
    } else if (replay?.replayData && cumulativeTimes.length > 0) {
      const keyState = new Array(keyCount).fill(false) as boolean[];
      const lastFrameIndex = bisectRight(cumulativeTimes, currentTime);

      // Get current key state from replay
      if (lastFrameIndex >= 0) {
        const keys = replay.replayData[lastFrameIndex].x;
        for (let col = 0; col < keyCount; col++) {
          if ((keys & (1 << col)) !== 0) {
            pressedColumns[col] = true;
          }
        }
      }

      // Track release times
      for (let i = 0; i < cumulativeTimes.length; i++) {
        const time = cumulativeTimes[i];
        if (time > currentTime) break;

        const keys = replay.replayData[i].x;

        for (let col = 0; col < keyCount; col++) {
          const isPressed = (keys & (1 << col)) !== 0;

          if (!isPressed && keyState[col]) {
            releaseTimeArray[col] = time;
          }
          keyState[col] = isPressed;
        }
      }
    }

    return { pressedKeys: pressedColumns, releaseTimes: releaseTimeArray };
  }, [cumulativeTimes, currentTime, hitObjects]);

  // Early return after all hooks
  if (!beatmap) {
    return null;
  }

  return (
    <AbsoluteFill style={stageStyle}>
      {/* Beat lines */}
      {showBeatLines && (
        <BeatLinesLayer
          beatLines={beatLines}
          beatOffset={beatOffset}
          currentTime={currentTime}
          visibleTime={visibleTime}
          judgmentY={judgmentY}
          stageX={stageX}
          scrollAlgorithm={scrollAlgorithm}
          timingPoints={timingPoints}
        />
      )}

      {/* Stage background */}
      <div
        className="stage-container"
        style={{
          left: stageX,
          opacity: stageBgOpacity,
        }}
      >
        {/* Column dividers */}
        {config.columnPositionsStage.slice(1).map((pos, i) => (
          <div
            key={i}
            className="column-divider"
            style={{
              left: pos - STAGE_X,
              width: 2,
            }}
          />
        ))}
      </div>

      {/* Judgment line */}
      {showJudgmentLine && (
        <div
          className="judgment-line"
          style={{
            left: stageX,
            top: judgmentY,
            width: config.stageWidth,
            height: 4,
            backgroundColor: "#00ff88",
            boxShadow: "0 0 15px #00ff88",
          }}
        />
      )}

      {/* Judgment zones */}
      {showJudgmentZones && visibleTime > 0 && (
        <JudgmentZonesLayer
          hitObjects={hitObjects}
          currentTime={currentTime}
          visibleTime={visibleTime}
          judgmentY={judgmentY}
          stageX={stageX}
          beatmap={beatmap}
          scrollAlgorithm={scrollAlgorithm}
        />
      )}

      {/* Notes */}
      {hitObjects.map((note, index) => (
        <ManiaNote
          key={`${note.time}-${note.column}-${index}`}
          note={note}
          scrollSpeed={scrollSpeed}
          scrollAlgorithm={scrollAlgorithm}
          judgmentLineY={judgmentLineY}
          stageOffset={stageOffset}
        />
      ))}

      {/* Replay cursor */}
      {showReplayCursor && (
        <ReplayCursor
          scrollSpeed={scrollSpeed}
          scrollAlgorithm={scrollAlgorithm}
          stageOffset={stageOffset}
          judgmentLineY={judgmentLineY}
        />
      )}

      {/* Key press indicators */}
      <KeyIndicatorsLayer
        pressedKeys={pressedKeys}
        judgmentY={judgmentY}
        stageX={stageX}
      />

      {/* Column highlights */}
      {showColumnHighlights && (
        <ColumnHighlightsLayer
          pressedKeys={pressedKeys}
          releaseTimes={releaseTimes}
          currentTime={currentTime}
          stageX={stageX}
        />
      )}

      {/* Hit effects */}
      <HitEffectsLayer
        hitObjects={hitObjects}
        currentTime={currentTime}
        stageX={stageX}
        judgmentY={judgmentY}
      />

      {/* Hitsounds */}
      {currentHitsounds.map((hs) => (
        <Audio
          key={hs.id}
          src={staticFile(hs.filename)}
          volume={() => hs.volume}
          startFrom={0}
        />
      ))}
    </AbsoluteFill>
  );
};

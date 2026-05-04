import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
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
  BASE_VISIBLE_TIME,
  type HitsoundsConfig,
  hitsoundConfig,
  MAX_HITSOUNDS_CONCURRENT,
} from "./config";
import { bisectRight } from "./lib/utils";
import {
  BeatLinesLayer,
  JudgmentZonesLayer,
  KeyIndicatorsLayer,
  ColumnHighlightsLayer,
  HitEffectsLayer,
} from "./components/stage";

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



  const durationMs =
    hitObjects.length > 0
      ? (hitObjects[hitObjects.length - 1].endTime ||
          hitObjects[hitObjects.length - 1].time) + 5000
      : 60000;

  // Calculate visible time based on AR and scroll speed - use consistent BASE_VISIBLE_TIME
  const baseVisibleTime = BASE_VISIBLE_TIME;
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

  // Pre-filter visible notes to avoid mounting 3000+ ManiaNote components
  const visibleNotes = useMemo(() => {
    if (hitObjects.length === 0) return hitObjects;

    const times = hitObjects.map(n => n.time);
    const margin = 500; // ms buffer (notes slightly off-screen)
    const earliestTime = currentTime - margin;
    const latestTime = currentTime + visibleTime + margin;

    // bisectRight returns last index where arr[i] <= value
    // For earliest: find first index where time >= earliestTime
    const leftIdx = Math.max(0, bisectRight(times, earliestTime - 0.001) + 1);
    // For latest: find last index where time <= latestTime
    const rightIdx = bisectRight(times, latestTime);

    if (leftIdx > rightIdx || rightIdx < 0) return [];
    return hitObjects.slice(leftIdx, rightIdx + 1);
  }, [hitObjects, currentTime, visibleTime]);

  // Cache hitsound metadata (computed once, no dependency on currentTime/frame)
  const hitsoundMeta = useMemo(() => {
    if (!hitsounds.enabled || hitsounds.trigger !== "auto") return [];

    const result: {
      noteFrame: number;
      key: string;
      filename: string;
      volume: number;
    }[] = [];

    for (const note of hitObjects) {
      const noteFrame = Math.round((note.time / 1000) * fps);
      const tp = timingPoints.length > 0
        ? timingPoints.reduce((prev, curr) =>
            curr.time <= note.time && curr.time > prev.time ? curr : prev,
          )
        : undefined;

      const infos = hitsoundManager.getHitsoundsForNote(
        note,
        tp,
        hitsounds.volume,
      );

      for (const info of infos) {
        if (!hitsoundConfig.availableFiles.has(info.filename)) continue;
        result.push({
          noteFrame,
          key: `${note.time}-${note.column}-${info.filename}`,
          filename: info.filename,
          volume: info.volume,
        });
      }
    }

    return result;
  }, [hitObjects, timingPoints, hitsounds.enabled, hitsounds.trigger, hitsounds.volume, fps]);

  // Only create Audio for notes whose 4-frame window includes the current frame
  const activeHitsounds = useMemo(() => {
    if (hitsoundMeta.length === 0) return null;

    const elements: React.ReactNode[] = [];
    let count = 0;

    for (const meta of hitsoundMeta) {
      const framesSinceHit = frame - meta.noteFrame;
      if (framesSinceHit >= 0 && framesSinceHit < 4) {
        elements.push(
          <Sequence key={meta.key} from={meta.noteFrame} durationInFrames={40}>
            <Audio
              src={staticFile(meta.filename)}
              volume={() => meta.volume}
            />
          </Sequence>,
        );
        if (++count >= MAX_HITSOUNDS_CONCURRENT) break;
      }
    }

    return elements.length > 0 ? elements : null;
  }, [frame, hitsoundMeta]);

  // Pre-compute sorted intervals (no currentTime dependency - computed once)
  const sortedIntervals = useMemo(() => {
    if (!isAutoplayMode()) return [];
    const intervals = getKeyIntervals(hitObjects);
    return [...intervals].sort((a, b) => a.start - b.start);
  }, [hitObjects]);

  // Pre-compute interval start times for binary search
  const intervalTimes = useMemo(() => {
    return sortedIntervals.map((i) => i.start);
  }, [sortedIntervals]);

  // Get key state: uses bisectRight for efficient lookup
  const { pressedKeys, releaseTimes } = useMemo(() => {
    const keyCount = getKeyCount();
    const pressedColumns = new Array(keyCount).fill(false) as boolean[];
    const releaseTimeArray = new Array(keyCount).fill(0) as number[];

    if (isAutoplayMode()) {
      if (sortedIntervals.length === 0) return { pressedKeys: pressedColumns, releaseTimes: releaseTimeArray };

      // Find the last interval that has started
      const lastActiveIdx = bisectRight(intervalTimes, currentTime);

      if (lastActiveIdx < 0) return { pressedKeys: pressedColumns, releaseTimes: releaseTimeArray };

      const keyState = new Array(keyCount).fill(false) as boolean[];

      // Only scan from (lastActiveIdx - keyCount * 2) to lastActiveIdx
      // This is enough because at most keyCount keys can be pressed at once
      const scanStart = Math.max(0, lastActiveIdx - keyCount * 4);
      for (let i = scanStart; i <= lastActiveIdx; i++) {
        const interval = sortedIntervals[i];
        const col = interval.column;

        if (interval.end <= currentTime) {
          if (keyState[col]) {
            releaseTimeArray[col] = interval.end;
            keyState[col] = false;
          }
        } else if (interval.start <= currentTime) {
          pressedColumns[col] = true;
          keyState[col] = true;
        }
      }
    } else if (replay?.replayData && cumulativeTimes.length > 0) {
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

      // Track release times: scan backwards from lastFrameIndex
      // Find the most recent key-up event for each column
      const keysFound = new Array(keyCount).fill(false) as boolean[];
      // Mark pressed columns as already found (visual opacity handled by isPressed)
      for (let col = 0; col < keyCount; col++) {
        keysFound[col] = pressedColumns[col];
      }

      if (lastFrameIndex >= 0) {
        // Initialize prevKeyState from the closest frame (current time)
        const prevKeyState = new Array(keyCount).fill(false) as boolean[];
        const currKeys = replay.replayData[lastFrameIndex].x;
        for (let col = 0; col < keyCount; col++) {
          prevKeyState[col] = (currKeys & (1 << col)) !== 0;
        }

        // Scan backwards to find release events
        // A release (going forward): key is pressed at frame i, not pressed at frame i+1
        // Going backward: check if isPressed at frame i, but !prevKeyState at frame i+1
        const scanEnd = Math.max(0, lastFrameIndex - 60);
        for (let i = lastFrameIndex - 1; i >= scanEnd; i--) {
          const frameKeys = replay.replayData[i].x;

          for (let col = 0; col < keyCount; col++) {
            if (!keysFound[col]) {
              const isPressed = (frameKeys & (1 << col)) !== 0;
              if (isPressed && !prevKeyState[col]) {
                // Going forward: pressed at i, not_pressed at i+1 => release at i+1
                releaseTimeArray[col] = cumulativeTimes[i + 1];
                keysFound[col] = true;
              }
            }
            prevKeyState[col] = (frameKeys & (1 << col)) !== 0;
          }

          if (keysFound.every((kf) => kf)) break;
        }
      }
    }

    return { pressedKeys: pressedColumns, releaseTimes: releaseTimeArray };
  }, [cumulativeTimes, currentTime, sortedIntervals, intervalTimes]);

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

      {/* Notes (pre-filtered to visible window) */}
      {visibleNotes.map((note, index) => (
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
        visibleTime={visibleTime}
      />

      {/* Hitsounds */}
      {activeHitsounds}
    </AbsoluteFill>
  );
};

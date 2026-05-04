import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo, useRef } from "react";
import { ParsedBeatmap } from "./lib/osuParser";
import { calculateDifficulty, calculateRealtimePP } from "./lib/difficulty";
import {
  getJudgmentResults,
  getJudgmentColor,
  JudgmentResult,
  setJudgmentMode,
  getJudgmentMode,
  setJudgmentOffset,
  isAutoplayMode,
} from "./lib/judgment";
import { bisectRight } from "./lib/utils";
import { config, STAGE_X } from "./config";
import { HitOffsetIndicator } from "./HitOffsetIndicator";

interface ManiaOverlayProps {
  beatmap?: ParsedBeatmap;
  judgmentMode?: "v1" | "v2" | "custom";
  judgmentOffset?: number;
  stageOffset?: number;
  judgmentTextY?: number;
  hitOffsetIndicator?: {
    enabled?: boolean;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    timeWindow?: number;
    maxHits?: number;
    maxOffset?: number;
    showCenterLine?: boolean;
    showLabels?: boolean;
  };
}

export const ManiaOverlay: React.FC<ManiaOverlayProps> = ({
  beatmap,
  judgmentMode,
  judgmentOffset = 0,
  stageOffset = 0,
  judgmentTextY = 750,
  hitOffsetIndicator,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Sync mode and offset from props (synchronous, no useEffect flash)
  if (judgmentMode) {
    setJudgmentMode(judgmentMode);
  }
  setJudgmentOffset(judgmentOffset);

  // Memoized difficulty calculation (static per beatmap)
  const difficultyResult = useMemo(
    () => (beatmap ? calculateDifficulty(beatmap) : null),
    [beatmap],
  );

  const mode = judgmentMode || getJudgmentMode();

  // Memoized judgments array (re-evaluated when mode or offset changes;
  // deps include mode/judgmentOffset because getJudgmentResults reads globals)
  const judgments = useMemo(() => {
    if (!beatmap) return [];
    return getJudgmentResults(beatmap.hitObjects, beatmap.difficulty.overallDifficulty);
  }, [beatmap, mode, judgmentOffset]);

  // Incremental score calculation using binary search and cached counts
  const prevCountsRef = useRef<{
    countPerfect: number;
    countGreat: number;
    countGood: number;
    countOk: number;
    countMeh: number;
    countMiss: number;
    maxCombo: number;
    tempCombo: number;
    lastJudgment: JudgmentResult | null;
    processedCount: number;
    lastJudgmentTime: number;
  }>({
    countPerfect: 0,
    countGreat: 0,
    countGood: 0,
    countOk: 0,
    countMeh: 0,
    countMiss: 0,
    maxCombo: 0,
    tempCombo: 0,
    lastJudgment: null,
    processedCount: 0,
    lastJudgmentTime: 0,
  });

  if (!beatmap) {
    return null;
  }

  const { metadata, difficulty } = beatmap;
  const currentTime = (frame / fps) * 1000;

  if (!difficultyResult) return null;

  // Get counts up to current time
  const currentIndex = bisectRight(judgments.map(j => j.hitTime), currentTime);
  const counts = prevCountsRef.current;

  // Reset if time went backwards (seeking)
  if (currentIndex < counts.processedCount - 1) {
    counts.countPerfect = 0;
    counts.countGreat = 0;
    counts.countGood = 0;
    counts.countOk = 0;
    counts.countMeh = 0;
    counts.countMiss = 0;
    counts.maxCombo = 0;
    counts.tempCombo = 0;
    counts.lastJudgment = null;
    counts.processedCount = 0;
    counts.lastJudgmentTime = 0;
  }

  // Process only new judgments since last frame
  for (let i = counts.processedCount; i <= currentIndex && i < judgments.length; i++) {
    const j = judgments[i];
    if (j.judgment === "Perfect") {
      counts.countPerfect++;
    } else if (j.judgment === "Great") {
      counts.countGreat++;
    } else if (j.judgment === "Good") {
      counts.countGood++;
    } else if (j.judgment === "Ok") {
      counts.countOk++;
    } else if (j.judgment === "Meh") {
      counts.countMeh++;
    } else if (j.judgment === "Miss") {
      counts.countMiss++;
      if (counts.tempCombo > counts.maxCombo) counts.maxCombo = counts.tempCombo;
      counts.tempCombo = 0;
    } else {
      counts.tempCombo++;
    }
    counts.lastJudgment = j;
  }

  // Check if current streak is new max
  if (counts.tempCombo > counts.maxCombo) counts.maxCombo = counts.tempCombo;

  // Update processed count
  counts.processedCount = currentIndex + 1;

  // Extract counts for rendering
  const {
    countPerfect,
    countGreat,
    countGood,
    countOk,
    countMeh,
    countMiss,
    lastJudgment,
  } = counts;

  // Calculate score
  const totalScore =
    countPerfect * 320 +
    countGreat * 300 +
    countGood * 200 +
    countOk * 100 +
    countMeh * 50;

  // Calculate real-time PP
  const realtimePP = calculateRealtimePP(beatmap, currentTime, counts.maxCombo, {
    countPerfect,
    countGreat,
    countGood,
    countOk,
    countMeh,
    countMiss,
  });

  return (
    <AbsoluteFill
      style={
        {
          "--stage-x": `${STAGE_X}px`,
          "--stage-width": `${config.stageWidth}px`,
        } as React.CSSProperties
      }
    >
      {/* Metadata display - top left */}
      <div
        style={{
          position: "absolute",
          top: 30,
          left: 30,
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 36, fontWeight: "bold", marginBottom: 8 }}>
          {metadata.titleUnicode || metadata.title}
        </div>
        <div style={{ fontSize: 24, color: "#aaa", marginBottom: 4 }}>
          {metadata.artistUnicode || metadata.artist}
        </div>
        <div style={{ fontSize: 18, color: "#666", marginBottom: 4 }}>
          {metadata.creator} [{metadata.version}]
        </div>
        <div style={{ fontSize: 16, color: "#555", marginTop: 8 }}>
          {difficulty.circleSize}K | AR {difficulty.approachRate} | OD{" "}
          {difficulty.overallDifficulty}
        </div>
        <div
          style={{
            fontSize: 16,
            color: "#FFD700",
            marginTop: 8,
            fontWeight: "bold",
          }}
        >
          ★ {difficultyResult.stars.toFixed(1)}
        </div>
      </div>

      {/* Score/Combo/PP display - top right */}
      <div
        style={{
          position: "absolute",
          top: 30,
          right: 30,
          color: "white",
          fontFamily: "monospace",
          fontSize: 32,
          textAlign: "right",
        }}
      >
        <div style={{ color: "#00ff88" }}>{realtimePP} pp</div>
        <div style={{ fontSize: 18, color: "#666" }}>x{counts.maxCombo}</div>
      </div>

      {/* Judgment stats - below score */}
      <div
        style={{
          position: "absolute",
          top: 100,
          right: 30,
          fontFamily: "monospace",
          fontSize: 18,
          textAlign: "right",
        }}
      >
        <div style={{ color: "#FF00FF" }}>{countPerfect}x320</div>
        <div style={{ color: "#00FF88" }}>{countGreat}x300</div>
        <div style={{ color: "#00AAFF" }}>{countGood}x200</div>
        <div style={{ color: "#FFAA00" }}>{countOk}x100</div>
        <div style={{ color: "#FF6666" }}>{countMeh}x50</div>
        <div style={{ color: "#888888" }}>{countMiss}xMiss</div>
        <div style={{ color: "#888", marginTop: 8 }}>Total: {totalScore}</div>

        {/* Current judgment mode indicator */}
        <div style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
          {mode.toUpperCase()} {isAutoplayMode() ? "(Autoplay)" : `(offset: ${judgmentOffset})`}
        </div>
      </div>

      {/* Last judgment indicator - center of track */}
      {lastJudgment && currentTime - lastJudgment.hitTime < 500 && (
        <div
          style={{
            position: "absolute",
            top: judgmentTextY,
            left: STAGE_X + config.stageWidth / 2 + stageOffset,
            transform: "translateX(-50%)",
            fontSize: 64,
            fontWeight: "bold",
            color: getJudgmentColor(lastJudgment.judgment),
            textShadow: `0 0 20px ${getJudgmentColor(lastJudgment.judgment)}`,
            zIndex: 200,
          }}
        >
          {lastJudgment.judgment}
        </div>
      )}

      {/* Hit offset indicator */}
      {hitOffsetIndicator?.enabled && (
        <HitOffsetIndicator
          beatmap={beatmap}
          enabled={hitOffsetIndicator.enabled}
          x={hitOffsetIndicator.x}
          y={hitOffsetIndicator.y}
          width={hitOffsetIndicator.width}
          height={hitOffsetIndicator.height}
          timeWindow={hitOffsetIndicator.timeWindow}
          maxHits={hitOffsetIndicator.maxHits}
          maxOffset={hitOffsetIndicator.maxOffset}
          showCenterLine={hitOffsetIndicator.showCenterLine}
          showLabels={hitOffsetIndicator.showLabels}
        />
      )}
    </AbsoluteFill>
  );
};

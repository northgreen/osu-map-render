import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo } from "react";
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
import { config, STAGE_X } from "./config";

interface ManiaOverlayProps {
  beatmap?: ParsedBeatmap;
  judgmentMode?: "v1" | "v2" | "custom";
  judgmentOffset?: number;
  stageOffset?: number;
  judgmentLineY?: number;
}

export const ManiaOverlay: React.FC<ManiaOverlayProps> = ({
  beatmap,
  judgmentMode,
  judgmentOffset = 0,
  stageOffset = 0,
  judgmentLineY = 900,
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

  if (!beatmap) {
    return null;
  }

  const { metadata, difficulty, hitObjects } = beatmap;
  const currentTime = (frame / fps) * 1000;

  if (!difficultyResult) return null;

  // Get judgment results
  const judgments = getJudgmentResults(
    hitObjects,
    difficulty.overallDifficulty,
  );

  // Calculate cumulative scores (osu!mania: Perfect=320, Great=300, Good=200, Ok=100, Meh=50, Miss=0)
  let countPerfect = 0,
    countGreat = 0,
    countGood = 0,
    countOk = 0,
    countMeh = 0,
    countMiss = 0;
  let lastJudgment: JudgmentResult | null = null;
  let currentCombo = 0;
  let maxCombo = 0;
  for (const j of judgments) {
    if (j.hitTime <= currentTime) {
      if (j.judgment === "Perfect") {
        countPerfect++;
        currentCombo++;
      } else if (j.judgment === "Great") {
        countGreat++;
        currentCombo++;
      } else if (j.judgment === "Good") {
        countGood++;
        currentCombo++;
      } else if (j.judgment === "Ok") {
        countOk++;
        currentCombo++;
      } else if (j.judgment === "Meh") {
        countMeh++;
        currentCombo++;
      } else if (j.judgment === "Miss") {
        currentCombo = 0;
        countMiss++;
      }
      if (currentCombo > maxCombo) maxCombo = currentCombo;
      lastJudgment = j;
    }
  }

  // Calculate score
  const totalScore =
    countPerfect * 320 +
    countGreat * 300 +
    countGood * 200 +
    countOk * 100 +
    countMeh * 50;

  // Calculate real-time PP (using actual judgment counts and real combo)
  const realtimePP = calculateRealtimePP(beatmap, currentTime, maxCombo, {
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
        <div style={{ fontSize: 18, color: "#666" }}>x{maxCombo}</div>
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
            top: judgmentLineY - 150,
            left: 320 + stageOffset,
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
    </AbsoluteFill>
  );
};

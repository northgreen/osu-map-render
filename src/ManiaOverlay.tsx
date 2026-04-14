import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useEffect } from "react";
import { ParsedBeatmap } from "./lib/osuParser";
import { calculateDifficulty, calculateRealtimePP } from "./lib/difficulty";
import { getJudgmentResults, getJudgmentColor, JudgmentResult, setJudgmentMode, getJudgmentMode, setJudgmentOffset, clearJudgmentCache } from "./lib/judgment";

interface ManiaOverlayProps {
  beatmap?: ParsedBeatmap;
  judgmentMode?: "v1" | "v2";
  judgmentOffset?: number;
}

export const ManiaOverlay: React.FC<ManiaOverlayProps> = ({ beatmap, judgmentMode, judgmentOffset = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Sync mode and offset from props
  useEffect(() => {
    if (judgmentMode) {
      setJudgmentMode(judgmentMode);
    }
    if (judgmentOffset !== undefined) {
      setJudgmentOffset(judgmentOffset);
    }
    clearJudgmentCache();
  }, [judgmentMode, judgmentOffset]);

  const mode = judgmentMode || getJudgmentMode();

  if (!beatmap) {
    return null;
  }

  const { metadata, difficulty, hitObjects } = beatmap;
  const currentTime = (frame / fps) * 1000;

  // Calculate difficulty
  const difficultyResult = calculateDifficulty(beatmap);

  // Get judgment results
  const judgments = getJudgmentResults(hitObjects, difficulty.overallDifficulty);

  // Calculate cumulative scores (osu!mania: Perfect=320, Great=300, Good=200, Ok=100, Meh=50, Miss=0)
  let countPerfect = 0, countGreat = 0, countGood = 0, countOk = 0, countMeh = 0, countMiss = 0;
  let lastJudgment: JudgmentResult | null = null;
  for (const j of judgments) {
    if (j.hitTime <= currentTime) {
      if (j.judgment === "Perfect") countPerfect++;
      else if (j.judgment === "Great") countGreat++;
      else if (j.judgment === "Good") countGood++;
      else if (j.judgment === "Ok") countOk++;
      else if (j.judgment === "Meh") countMeh++;
      else if (j.judgment === "Miss") countMiss++;
      lastJudgment = j;
    }
  }

  // Calculate score
  const totalScore = countPerfect * 320 + countGreat * 300 + countGood * 200 +
                     countOk * 100 + countMeh * 50;

  // Calculate real-time PP (using actual judgment counts)
  // Convert new judgment types to old format for PP calculation
  const realtimePP = calculateRealtimePP(
    beatmap,
    currentTime,
    Math.floor(currentTime / 100),
    {
      count300: countPerfect + countGreat,  // Perfect(320) + Great(300) count as 300
      count100: countGood + countOk,         // Good(200) + Ok(100) count as 100
      count50: countMeh,                      // Meh(50)
      countMiss: countMiss
    }
  );

  return (
    <AbsoluteFill>
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
          {difficulty.circleSize}K | AR {difficulty.approachRate} | OD {difficulty.overallDifficulty}
        </div>
        <div style={{ fontSize: 16, color: "#FFD700", marginTop: 8, fontWeight: "bold" }}>
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
        <div style={{ fontSize: 18, color: "#666" }}>x{Math.floor(currentTime / 100)}</div>
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
        <div style={{ color: "#888", marginTop: 8 }}>
          Total: {totalScore}
        </div>

        {/* Current judgment mode indicator */}
        <div style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
          {mode.toUpperCase()} (offset: {judgmentOffset})
        </div>
      </div>

      {/* Last judgment indicator - center of track */}
      {lastJudgment && currentTime - lastJudgment.hitTime < 500 && (
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: 320,
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
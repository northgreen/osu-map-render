import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ParsedBeatmap } from "./lib/osuParser";
import { calculateDifficulty, calculateRealtimePP } from "./lib/difficulty";
import { getJudgmentResults } from "./lib/judgment";
import { getJudgmentColor, JudgmentResult } from "./lib/judgment";

interface ManiaOverlayProps {
  beatmap?: ParsedBeatmap;
}

export const ManiaOverlay: React.FC<ManiaOverlayProps> = ({ beatmap }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!beatmap) {
    return null;
  }

  const { metadata, difficulty, hitObjects } = beatmap;
  const currentTime = (frame / fps) * 1000;

  // Calculate difficulty
  const difficultyResult = calculateDifficulty(beatmap);

  // Calculate real-time PP
  const realtimePP = calculateRealtimePP(
    beatmap,
    currentTime,
    Math.floor(currentTime / 100),
    { count300: Math.floor(hitObjects.length * 0.9), count100: 0, count50: 0, countMiss: 0 }
  );

  // Get judgment results
  const judgments = getJudgmentResults(hitObjects, difficulty.overallDifficulty);

  // Calculate cumulative scores
  let count300 = 0, count100 = 0, count50 = 0, countMiss = 0;
  let lastJudgment: JudgmentResult | null = null;
  for (const j of judgments) {
    if (j.hitTime <= currentTime) {
      if (j.judgment === "300") count300++;
      else if (j.judgment === "100") count100++;
      else if (j.judgment === "50") count50++;
      else if (j.judgment === "Miss") countMiss++;
      lastJudgment = j;
    }
  }

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
        <div style={{ color: "#00FF88" }}>{count300}x300</div>
        <div style={{ color: "#00AAFF" }}>{count100}x100</div>
        <div style={{ color: "#FFAA00" }}>{count50}x50</div>
        <div style={{ color: "#FF4444" }}>{countMiss}xMiss</div>
        <div style={{ color: "#888", marginTop: 8 }}>
          Total: {count300 * 300 + count100 * 100 + count50 * 50}
        </div>
      </div>

      {/* Last judgment indicator - center */}
      {lastJudgment && currentTime - lastJudgment.hitTime < 500 && (
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            transform: "translate(-50%, -50%)",
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
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ParsedBeatmap, TimingPoint } from "./lib/osuParser";
import { ManiaNote } from "./ManiaNote";
import { ReplayCursor } from "./ReplayCursor";
import { JudgmentIndicator, clearJudgmentCache } from "./JudgmentIndicator";
import { replay, KEY_K1, KEY_K2, KEY_M1, KEY_M2 } from "./lib/replay";
import { calculateDifficulty, calculateRealtimePP } from "./lib/difficulty";
import { getJudgmentResults, JudgmentResult, getJudgmentColor } from "./lib/judgment";
import {
  COLUMN_POSITIONS_STAGE,
  COLUMN_WIDTH,
  NOTE_HEIGHT,
  STAGE_WIDTH,
  STAGE_X,
  STAGE_HEIGHT,
  JUDGMENT_LINE_Y,
  HIT_EFFECT_DURATION,
} from "./config";

interface ManiaStageProps {
  beatmap?: ParsedBeatmap;
}

// Generate beat lines based on timing points
function generateBeatLines(timingPoints: TimingPoint[], durationMs: number): number[] {
  const beatLines: number[] = [];
  if (timingPoints.length === 0) return beatLines;

  // Get all uninherited timing points (these define BPM)
  const uninheritedPoints = timingPoints.filter(tp => tp.uninherited);
  if (uninheritedPoints.length === 0) return beatLines;

  // For each uninherited timing point, generate beat lines
  for (let i = 0; i < uninheritedPoints.length; i++) {
    const tp = uninheritedPoints[i];
    const nextTp = uninheritedPoints[i + 1];
    const endTime = nextTp ? nextTp.time : durationMs + 5000;

    const msPerBeat = Math.abs(tp.beatLength);

    // Generate beat lines from this TP's time until next TP
    for (let time = tp.time; time < endTime; time += msPerBeat) {
      if (time > 0) beatLines.push(time);
    }
  }

  return beatLines;
}

export const ManiaStage: React.FC<ManiaStageProps> = ({ beatmap }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!beatmap) {
    return (
      <AbsoluteFill style={{ backgroundColor: "#1a1a2e", justifyContent: "center", alignItems: "center" }}>
        <div style={{ color: "white", fontSize: 24 }}>No beatmap loaded</div>
      </AbsoluteFill>
    );
  }

  const { metadata, difficulty, hitObjects, timingPoints, backgroundImage } = beatmap;
  const currentTime = (frame / fps) * 1000;

  // Calculate difficulty (only once at frame 0)
  const difficultyResult = calculateDifficulty(beatmap);

  // Calculate real-time PP based on current progress
  // Assume full accuracy for now (can be enhanced with replay data)
  const realtimePP = calculateRealtimePP(
    beatmap,
    currentTime,
    Math.floor(currentTime / 100), // Approximate combo based on time
    { count300: Math.floor(hitObjects.length * 0.9), count100: 0, count50: 0, countMiss: 0 }
  );

  // Get judgment results for current time display
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

  // Debug first frame
  if (frame === 0) {
    console.log("beatmap loaded, hitObjects:", hitObjects.length, "first note time:", hitObjects[0]?.time);
    console.log("Difficulty:", difficultyResult);
  }

  const durationMs = beatmap.hitObjects.length > 0
    ? beatmap.hitObjects[beatmap.hitObjects.length - 1].endTime || beatmap.hitObjects[beatmap.hitObjects.length - 1].time
    : 60000;

  // Find current replay frame and pressed keys
  const getPressedKeys = () => {
    const pressedColumns: boolean[] = [false, false, false, false];

    if (!replay?.replayData) return pressedColumns;

    // Find the frame at or before currentTime
    let cumulativeTime = 0;
    for (const frame of replay.replayData) {
      cumulativeTime += frame.timeOffset;
      if (cumulativeTime > currentTime) break;

      const keys = frame.keys;
      // For 4-key: typically K1=column 0, K2=column 1, M1=column 2, M2=column 3
      // But mapping varies - use Y position to determine column
      if (frame.y >= 0 && frame.y < 384) {
        const column = Math.floor(frame.y / 96); // 384/4 = 96 per column
        if (column >= 0 && column < 4) {
          // Check if any key is pressed
          if (keys & KEY_K1 || keys & KEY_M1) pressedColumns[column] = true;
          // Check adjacent column for K2/M2
          if (keys & KEY_K2 || keys & KEY_M2) pressedColumns[(column + 1) % 4] = true;
        }
      }
    }

    return pressedColumns;
  };

  const pressedKeys = getPressedKeys();

  // Generate beat lines
  const beatLines = generateBeatLines(timingPoints, durationMs);

  // Calculate visible time based on AR
  const visibleTime = difficulty.approachRate < 5
    ? 1200 + (5 - difficulty.approachRate) * 120
    : difficulty.approachRate > 5
    ? 1200 - (difficulty.approachRate - 5) * 120
    : 1200;

  // Get the background image filename from beatmap
  const bgFileName = backgroundImage ? backgroundImage.replace(/"/g, "") : null;

  return (
    <AbsoluteFill style={{ backgroundColor: "#1a1a2e" }}>
      {/* Background image */}
      {bgFileName && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1920,
            height: 1080,
            overflow: "hidden",
          }}
        >
          <img
            src={staticFile(bgFileName)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.6,
            }}
          />
        </div>
      )}

      {/* Audio */}
      <Audio src={staticFile("audio.mp3")} />

      {/* Beat lines */}
      {beatLines.map((time, i) => {
        const timeUntilHit = time - currentTime;
        if (timeUntilHit > visibleTime || timeUntilHit < -500) return null;

        const progress = 1 - timeUntilHit / visibleTime;
        const y = progress * JUDGMENT_LINE_Y;
        const isBarLine = i % 4 === 0; // Every 4 beats is a bar

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: STAGE_X,
              top: y,
              width: STAGE_WIDTH,
              height: isBarLine ? 2 : 1,
              backgroundColor: isBarLine ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)",
              opacity: Math.max(0, Math.min(1, 1 - timeUntilHit / 500)),
            }}
          />
        );
      })}

      {/* Stage background */}
      <div
        style={{
          position: "absolute",
          left: STAGE_X,
          top: 0,
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
          backgroundColor: "#16213e",
          borderLeft: "2px solid #444",
          borderRight: "2px solid #444",
        }}
      >
        {/* Column dividers */}
        {COLUMN_POSITIONS_STAGE.slice(1).map((pos, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: pos - STAGE_X,
              top: 0,
              width: 2,
              height: 1080,
              backgroundColor: "#2a2a4a",
            }}
          />
        ))}

        {/* Lane effects - subtle gradient per column */}
        {
        //   COLUMN_POSITIONS_STAGE.map((pos, i) => (
        //   <div
        //     key={`lane-${i}`}
        //     style={{
        //       position: "absolute",
        //       left: pos - COLUMN_WIDTH / 2 - STAGE_X,
        //       top: 0,
        //       width: COLUMN_WIDTH,
        //       height: 1080,
        //       opacity: 0.2,
        //       background: `linear-gradient(180deg, transparent 0%, ${
        //         ["#FF6B6B", "#4ECDC4", "#4ECDC4", "#FF6B6B"][i]
        //       } 50%, transparent 100%)`,
        //     }}
        //   />
        // ))
        }
      </div>

      {/* Judgment line */}
      <div
        style={{
          position: "absolute",
          left: STAGE_X,
          top: JUDGMENT_LINE_Y,
          width: STAGE_WIDTH,
          height: 4,
          backgroundColor: "#00ff88",
          boxShadow: "0 0 15px #00ff88",
        }}
      />

      {/* Key press indicators at bottom */}
      {COLUMN_POSITIONS_STAGE.map((pos, i) => {
        const isPressed = pressedKeys[i];
        const colors = ["#FF6B6B", "#4ECDC4", "#4ECDC4", "#FF6B6B"];
        const color = colors[i];
        return (
          <div
            key={`key-${i}`}
            style={{
              position: "absolute",
              left: STAGE_X + pos - COLUMN_WIDTH / 2,
              top: JUDGMENT_LINE_Y + 10,
              width: COLUMN_WIDTH,
              height: 60,
              backgroundColor: isPressed ? color : "#2a2a4a",
              opacity: isPressed ? 0.8 : 1,
              borderRadius: "0 0 8 8",
              border: `2px solid ${isPressed ? color : "#444"}`,
              borderTop: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: "bold",
              color: isPressed ? "#fff" : "#666",
              boxShadow: isPressed ? `0 0 20px ${color}` : "none",
              transition: "all 0.05s",
            }}
          >
            {["D", "F", "J", "K"][i]}
          </div>
        );
      })}

      {/* Notes */}
      {hitObjects.map((note, index) => (
        <ManiaNote
          key={`${note.time}-${note.column}-${index}`}
          note={note}
        />
      ))}

      {/* Replay cursor - shows player key presses falling */}
      <ReplayCursor />

      {/* Judgment indicators */}
      {
      // <JudgmentIndicator
      //   hitObjects={hitObjects}
      //   od={difficulty.overallDifficulty}
      //   currentTime={currentTime}
      // />
      }

      {/* Hit effects - column highlight */}
      {hitObjects.map((note, index) => {
        const startTime = note.time;
        const endTime = note.isLongNote && note.endTime ? note.endTime : note.time + HIT_EFFECT_DURATION;

        // For LN: column stays lit while held
        // For regular note: light up for HIT_EFFECT_DURATION ms after hit with fade out
        const isActive = note.isLongNote
          ? (currentTime >= startTime && currentTime <= endTime)
          : (currentTime >= startTime && currentTime < startTime + HIT_EFFECT_DURATION);

        if (isActive) {
          const column = Math.min(note.column, 3);
          const posX = COLUMN_POSITIONS_STAGE[column];
          const colors = ["#FF6B6B", "#4ECDC4", "#4ECDC4", "#FF6B6B"];
          const color = colors[column];

          // Calculate fade out for regular notes
          const timeSinceHit = currentTime - startTime;
          const fadeProgress = note.isLongNote ? 0 : (timeSinceHit / HIT_EFFECT_DURATION);
          const opacity = note.isLongNote
            ? Math.min(0.2, (endTime - currentTime) / 200 + 0.3)
            : 0.1 * (1 - fadeProgress);

          return (
            <div
              key={`col-hit-${startTime}-${note.column}-${index}`}
              style={{
                position: "absolute",
                left: STAGE_X + posX - COLUMN_WIDTH / 2,
                top: 0,
                width: COLUMN_WIDTH,
                height: 1080,
                backgroundColor: color,
                opacity,
                pointerEvents: "none",
              }}
            />
          );
        }
        return null;
      })}

      {/* Hit effects - note flash */}
      {hitObjects.map((note, index) => {
        const column = Math.min(note.column, 3);
        const posX = COLUMN_POSITIONS_STAGE[column];
        const colors = ["#FF6B6B", "#4ECDC4", "#4ECDC4", "#FF6B6B"];
        const color = colors[column];

        // For LN: flash at head and tail
        // For regular note: flash once
        const flashTimes = note.isLongNote && note.endTime
          ? [note.time, note.endTime]
          : [note.time];

        return (
          <>
            {flashTimes.map((flashTime, flashIndex) => {
              const timeSinceHit = currentTime - flashTime;

              // Show effect for HIT_EFFECT_DURATION ms after flash with fade out
              if (timeSinceHit >= 0 && timeSinceHit < HIT_EFFECT_DURATION) {
                const progress = timeSinceHit / HIT_EFFECT_DURATION;

                return (
                  <div
                    key={`hit-${flashTime}-${note.column}-${index}-${flashIndex}`}
                    style={{
                      position: "absolute",
                      left: STAGE_X + posX - COLUMN_WIDTH / 2,
                      top: JUDGMENT_LINE_Y,
                      width: COLUMN_WIDTH,
                      height: NOTE_HEIGHT,
                      backgroundColor: color,
                      opacity: 1 - progress,
                      borderRadius: 4,
                      boxShadow: `0 0 ${20 * (1 - progress)}px ${color}`,
                    }}
                  />
                );
              }
              return null;
            })}
          </>
        );
      })}

      {/* Metadata display */}
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
        <div style={{ fontSize: 18, color: "#666" }}>
          {metadata.creator} [{metadata.version}]
        </div>
        <div style={{ fontSize: 16, color: "#555", marginTop: 8 }}>
          {difficulty.circleSize}K | AR {difficulty.approachRate} | OD {difficulty.overallDifficulty}
        </div>
        <div style={{ fontSize: 16, color: "#FFD700", marginTop: 8, fontWeight: "bold" }}>
          ★ {difficultyResult.stars.toFixed(1)}
        </div>
      </div>

      {/* Score/Combo/PP display */}
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

      {/* Judgment stats display */}
      {

      // <div
      //   style={{
      //     position: "absolute",
      //     top: 100,
      //     right: 30,
      //     fontFamily: "monospace",
      //     fontSize: 18,
      //     textAlign: "right",
      //   }}
      // >
      //   <div style={{ color: "#00FF88" }}>{count300}x300</div>
      //   <div style={{ color: "#00AAFF" }}>{count100}x100</div>
      //   <div style={{ color: "#FFAA00" }}>{count50}x50</div>
      //   <div style={{ color: "#FF4444" }}>{countMiss}xMiss</div>
      //   <div style={{ color: "#888", marginTop: 8 }}>
      //     Total: {count300 * 300 + count100 * 100 + count50 * 50}
      //   </div>
      // </div>
      }

      {/* Last judgment indicator */}
      {
      //   lastJudgment && currentTime - lastJudgment.hitTime < 500 && (
      //   <div
      //     style={{
      //       position: "absolute",
      //       top: "40%",
      //       left: "50%",
      //       transform: "translate(-50%, -50%)",
      //       fontSize: 64,
      //       fontWeight: "bold",
      //       color: getJudgmentColor(lastJudgment.judgment),
      //       textShadow: `0 0 20px ${getJudgmentColor(lastJudgment.judgment)}`,
      //       zIndex: 200,
      //     }}
      //   >
      //     {lastJudgment.judgment}
      //   </div>
      // )
      }
    </AbsoluteFill>
  );
};

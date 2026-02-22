/**
 * FlappyArm — score, pause, game over UI. ArmPal style (black/white + red accent).
 */

import React from "react";
import { CANVAS_W, PALETTE } from "./constants.js";

const styles = {
  wrap: {
    position: "relative",
    padding: "20px 16px 90px",
    maxWidth: "400px",
    margin: "0 auto",
  },
  backBtn: {
    marginBottom: 12,
    padding: "8px 0",
    background: "none",
    border: "none",
    color: "var(--text-dim)",
    fontSize: 14,
    cursor: "pointer",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: 800, margin: 0, color: "var(--text)" },
  leaderboardBtn: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  scoreBar: {
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 0",
    fontSize: 15,
    fontWeight: 700,
    color: "var(--text)",
  },
  canvasWrap: {
    position: "relative",
    display: "inline-block",
    margin: "0 auto",
    maxWidth: CANVAS_W,
  },
  scoreOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 12,
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none",
    zIndex: 10,
  },
  scoreText: {
    fontSize: 28,
    fontWeight: 900,
    color: "#fff",
    textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 0 12px rgba(0,0,0,0.5)",
    transition: "transform 0.1s ease-out",
  },
  section: { textAlign: "center", marginTop: 24 },
  instruction: { color: "var(--text-dim)", fontSize: 14, margin: "0 0 8px" },
  difficulty: { color: "var(--text-dim)", fontSize: 12, margin: "0 0 20px" },
  primaryBtn: {
    padding: "14px 28px",
    borderRadius: 12,
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontWeight: 700,
    fontSize: 16,
    cursor: "pointer",
  },
  secondaryBtn: {
    marginTop: 10,
    padding: "12px 20px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.85)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 16,
  },
  overlayCard: {
    background: "linear-gradient(165deg, var(--card) 0%, var(--card-2) 100%)",
    borderRadius: 20,
    padding: 28,
    border: "1px solid var(--border)",
    textAlign: "center",
    maxWidth: 320,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.4)",
  },
  overlayTitle: { fontSize: 22, fontWeight: 900, margin: "0 0 16px", color: "var(--text)" },
  overlayScore: { fontSize: 18, fontWeight: 700, margin: "0 0 4px", color: "var(--text)" },
  overlayBest: { fontSize: 14, color: "var(--text-dim)", margin: "0 0 12px" },
  newRecord: { fontSize: 16, fontWeight: 800, color: "var(--accent)", margin: "0 0 16px" },
  debugBar: {
    position: "absolute",
    bottom: 4,
    left: 4,
    right: 4,
    fontSize: 10,
    color: "lime",
    fontFamily: "monospace",
    pointerEvents: "none",
    zIndex: 20,
  },
};

export function ScoreBar({ score, bestScore, loadingStats }) {
  return (
    <div style={styles.scoreBar}>
      <span>Score: {score}</span>
      {!loadingStats && <span>Best: {bestScore}</span>}
    </div>
  );
}

export function InGameScore({ score, popScale = 1 }) {
  return (
    <div style={styles.scoreOverlay}>
      <span style={{ ...styles.scoreText, transform: `scale(${popScale})` }}>{score}</span>
    </div>
  );
}

export function GameOverOverlay({ score, bestScore, isNewRecord, onPlayAgain, onBack }) {
  return (
    <div style={styles.overlay}>
      <div style={styles.overlayCard}>
        <h3 style={styles.overlayTitle}>Game Over</h3>
        <p style={styles.overlayScore}>Score: {score}</p>
        <p style={styles.overlayBest}>Best: {bestScore}</p>
        {isNewRecord && <p style={styles.newRecord}>New Record!</p>}
        <button type="button" style={styles.primaryBtn} onClick={onPlayAgain}>
          Play Again
        </button>
        <button type="button" style={styles.secondaryBtn} onClick={onBack}>
          Back to Games
        </button>
      </div>
    </div>
  );
}

export function IdleScreen({ onStart, disabled }) {
  return (
    <div style={styles.section}>
      <p style={styles.instruction}>Tap to raise your arm. Avoid the obstacles!</p>
      <p style={styles.difficulty}>Wide gaps · 800ms grace after start</p>
      <button type="button" style={styles.primaryBtn} onClick={onStart} disabled={disabled}>
        Start
      </button>
    </div>
  );
}

export function DebugOverlay({ fps, assetStatus, show }) {
  if (!show) return null;
  const status = assetStatus
    ? Object.entries(assetStatus)
        .map(([k, v]) => `${k}:${v ? "ok" : "—"}`)
        .join(" ")
    : "—";
  return (
    <div style={styles.debugBar}>
      FPS: {fps} | {status}
    </div>
  );
}

export { styles };

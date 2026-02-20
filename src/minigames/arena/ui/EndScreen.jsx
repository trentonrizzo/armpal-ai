/**
 * Match end overlay: win/loss, stats, back button
 */
import React from "react";

const overlay = {
  position: "absolute",
  inset: 0,
  background: "rgba(0,0,0,0.85)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100,
  padding: 24,
};
const title = { fontSize: 28, fontWeight: 900, color: "var(--text)", marginBottom: 8 };
const sub = { fontSize: 16, color: "var(--text-dim)", marginBottom: 24 };
const btn = {
  padding: "14px 28px",
  borderRadius: 12,
  border: "none",
  background: "var(--accent)",
  color: "var(--text)",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
};

export default function EndScreen({ won, kills, deaths, onExit }) {
  return (
    <div style={overlay}>
      <div style={title}>{won ? "Victory" : "Defeat"}</div>
      <div style={sub}>
        Kills: {kills} · Deaths: {deaths}
      </div>
      <button type="button" style={btn} onClick={onExit}>
        Back to Lobby
      </button>
    </div>
  );
}

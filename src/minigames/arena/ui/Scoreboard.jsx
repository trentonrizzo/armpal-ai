/**
 * In-game scoreboard (optional overlay)
 */
import React from "react";

const wrap = {
  position: "absolute",
  left: "50%",
  top: 48,
  transform: "translateX(-50%)",
  display: "flex",
  gap: 24,
  padding: "6px 16px",
  background: "rgba(0,0,0,0.6)",
  borderRadius: 10,
  border: "1px solid var(--border)",
  pointerEvents: "none",
  zIndex: 19,
};
const row = { color: "var(--text)", fontSize: 14, fontWeight: 700 };

export default function Scoreboard({ slot1Kills = 0, slot2Kills = 0 }) {
  return (
    <div style={wrap}>
      <span style={row}>You: {slot1Kills}</span>
      <span style={{ ...row, color: "var(--text-dim)" }}>–</span>
      <span style={row}>Enemy: {slot2Kills}</span>
    </div>
  );
}

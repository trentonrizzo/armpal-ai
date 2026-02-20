/**
 * In-game HUD: health, score, timer
 */
import React from "react";

const wrap = {
  position: "absolute",
  left: 0,
  right: 0,
  top: 0,
  padding: "12px 16px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  pointerEvents: "none",
  zIndex: 20,
};
const healthBar = {
  width: 120,
  height: 12,
  background: "rgba(0,0,0,0.5)",
  borderRadius: 6,
  overflow: "hidden",
  border: "1px solid var(--border)",
};
const healthFill = (pct) => ({
  width: `${Math.max(0, Math.min(100, pct))}%`,
  height: "100%",
  background: pct > 30 ? "var(--accent)" : "#c00",
  transition: "width 0.2s ease",
});
const scoreStyle = { color: "var(--text)", fontSize: 18, fontWeight: 800 };
const timerStyle = { color: "var(--text-dim)", fontSize: 16, fontWeight: 700 };

export default function HUD({ health = 100, kills = 0, deaths = 0, timeLeft = 0 }) {
  return (
    <div style={wrap}>
      <div>
        <div style={healthBar}>
          <div style={healthFill(health)} />
        </div>
        <div style={{ ...scoreStyle, marginTop: 4 }}>{kills} / 7</div>
      </div>
      <div style={timerStyle}>{Math.max(0, Math.ceil(timeLeft))}s</div>
    </div>
  );
}

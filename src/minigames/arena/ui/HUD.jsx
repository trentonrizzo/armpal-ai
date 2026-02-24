/**
 * In-game HUD: top-left back + settings; top score/timer; bottom health + ammo (Fortnite-like).
 */
import React from "react";

const topBar = {
  position: "absolute",
  left: 0,
  right: 0,
  top: 0,
  padding: "12px 16px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  zIndex: 20,
};
const topLeft = { display: "flex", gap: 8, alignItems: "center" };
const iconBtn = {
  width: 40,
  height: 40,
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "rgba(0,0,0,0.5)",
  color: "var(--text)",
  fontSize: 18,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const scoreStyle = { color: "var(--text)", fontSize: 18, fontWeight: 800 };
const timerStyle = { color: "var(--text-dim)", fontSize: 16, fontWeight: 700 };

const bottomBar = {
  position: "absolute",
  left: 16,
  right: 16,
  bottom: 24,
  display: "flex",
  alignItems: "flex-end",
  gap: 16,
  zIndex: 20,
};
const healthWrap = {};
const healthBar = {
  width: 160,
  height: 14,
  background: "rgba(0,0,0,0.6)",
  borderRadius: 7,
  overflow: "hidden",
  border: "1px solid var(--border)",
};
const healthFill = (pct) => ({
  width: `${Math.max(0, Math.min(100, pct))}%`,
  height: "100%",
  background: pct > 30 ? "var(--accent)" : "#c00",
  transition: "width 0.2s ease",
});
const healthNum = { color: "var(--text)", fontSize: 14, fontWeight: 700, marginTop: 4 };
const ammoWrap = { textAlign: "right" };
const ammoNum = { color: "var(--text)", fontSize: 18, fontWeight: 800 };
const ammoReserve = { color: "var(--text-dim)", fontSize: 12 };
const shieldPlaceholder = { fontSize: 11, color: "var(--text-dim)", marginTop: 4 };

export default function HUD({
  health = 100,
  kills = 0,
  deaths = 0,
  timeLeft = 0,
  mag = 0,
  reserve = 0,
  onBack,
  onSettings,
  onOpenLookSettings,
}) {
  return (
    <>
      <div style={topBar}>
        <div style={topLeft}>
          {onBack && (
            <button type="button" style={iconBtn} onClick={onBack} title="Leave match">
              ←
            </button>
          )}
          {onOpenLookSettings && (
            <button type="button" style={iconBtn} onClick={onOpenLookSettings} title="Look settings">
              ⚙️
            </button>
          )}
          {onSettings && (
            <button type="button" style={iconBtn} onClick={onSettings} title="Settings">
              ⚙
            </button>
          )}
        </div>
        <div style={scoreStyle}>{kills} / 7</div>
        <div style={timerStyle}>{Math.max(0, Math.ceil(timeLeft))}s</div>
      </div>
      <div style={bottomBar}>
        <div style={healthWrap}>
          <div style={healthBar}>
            <div style={healthFill(health)} />
          </div>
          <div style={healthNum}>{Math.max(0, Math.ceil(health))}</div>
          <div style={shieldPlaceholder}>Shield (soon)</div>
        </div>
        <div style={ammoWrap}>
          <div style={ammoNum}>{mag} / {reserve}</div>
          <div style={ammoReserve}>ammo</div>
        </div>
      </div>
    </>
  );
}

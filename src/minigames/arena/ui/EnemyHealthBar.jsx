/**
 * Small health bar above enemy head; visible when in view / within distance.
 * Parent provides screen position (e.g. from project(enemyHeadPos)).
 */
import React from "react";

const wrap = {
  position: "absolute",
  width: 60,
  height: 8,
  background: "rgba(0,0,0,0.7)",
  borderRadius: 4,
  overflow: "hidden",
  border: "1px solid var(--border)",
  pointerEvents: "none",
  zIndex: 22,
  transform: "translate(-50%, 0)",
};
const fill = (pct) => ({
  width: `${Math.max(0, Math.min(100, pct))}%`,
  height: "100%",
  background: pct > 30 ? "#c00" : "#800",
  transition: "width 0.15s ease",
});

export default function EnemyHealthBar({ left, top, health = 100, visible = true }) {
  if (!visible || left == null || top == null) return null;
  return (
    <div style={{ ...wrap, left, top }}>
      <div style={fill(health)} />
    </div>
  );
}

/**
 * Sniper ADS scope overlay (circular vignette + crosshair)
 */
import React from "react";

const wrap = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  zIndex: 35,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const circle = {
  width: "70vmin",
  height: "70vmin",
  borderRadius: "50%",
  border: "4px solid rgba(0,0,0,0.85)",
  boxShadow: "inset 0 0 60px rgba(0,0,0,0.6), 0 0 0 9999px rgba(0,0,0,0.75)",
};
const cross = {
  position: "absolute",
  width: 2,
  height: 20,
  background: "rgba(255,255,255,0.6)",
  borderRadius: 1,
};
const crossV = { ...cross, height: 20 };
const crossH = { ...cross, width: 20, height: 2 };

export default function ScopeOverlay({ show }) {
  if (!show) return null;
  return (
    <div style={wrap}>
      <div style={circle} />
      <div style={{ ...crossV, left: "50%", top: "50%", transform: "translate(-50%, -50%)" }} />
      <div style={{ ...crossH, left: "50%", top: "50%", transform: "translate(-50%, -50%)" }} />
    </div>
  );
}

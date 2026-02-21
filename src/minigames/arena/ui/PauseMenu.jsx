/**
 * In-game pause overlay: Resume, Settings, Controls/Binds, Leave Match, Audio placeholders.
 * Opening unlocks pointer; Resume re-locks.
 */
import React from "react";

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.88)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 200,
  color: "var(--text)",
  padding: 24,
};
const title = { fontSize: 24, fontWeight: 900, marginBottom: 24 };
const btn = {
  width: "100%",
  maxWidth: 280,
  padding: 14,
  marginBottom: 10,
  borderRadius: 12,
  border: "none",
  background: "var(--accent)",
  color: "var(--text)",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
};
const btnDanger = { ...btn, background: "#c00", color: "#fff" };
const btnSecondary = { ...btn, background: "var(--card-2)", border: "1px solid var(--border)" };
const audioPlaceholder = { fontSize: 12, color: "var(--text-dim)", marginTop: 8 };

export default function PauseMenu({
  onResume,
  onSettings,
  onControls,
  onLeaveMatch,
}) {
  return (
    <div style={overlay}>
      <h2 style={title}>Paused</h2>
      <button type="button" style={btn} onClick={onResume}>
        Resume
      </button>
      <button type="button" style={btnSecondary} onClick={onSettings}>
        Settings
      </button>
      <button type="button" style={btnSecondary} onClick={onControls}>
        Controls / Binds
      </button>
      <button type="button" style={btnDanger} onClick={onLeaveMatch}>
        Leave Match
      </button>
      <div style={audioPlaceholder}>Audio (coming soon)</div>
    </div>
  );
}

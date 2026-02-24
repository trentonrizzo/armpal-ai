/**
 * In-game look settings overlay: Sensitivity X/Y, Invert Y.
 * Reusable in both Multiplayer Arena and Arena Trainer.
 * When open: unlock pointer lock; when closed: re-lock on canvas click (handled by parent).
 */
import React, { useEffect } from "react";

const OVERLAY = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.85)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 200,
  color: "var(--text)",
  padding: 24,
};
const CARD = {
  background: "var(--card-2)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: 24,
  maxWidth: 360,
  width: "100%",
};
const TITLE = { fontSize: 20, fontWeight: 800, marginBottom: 20 };
const ROW = { marginBottom: 16 };
const LABEL = { display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6, color: "var(--text)" };
const SLIDER = { width: "100%", accentColor: "var(--accent)" };
const TOGGLE_ROW = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 };
const BTN = {
  padding: "12px 20px",
  borderRadius: 10,
  border: "none",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
};
const BTN_PRIMARY = { ...BTN, background: "var(--accent)", color: "var(--text)" };

export default function ArenaSettingsOverlay({
  open,
  onClose,
  settings,
  onSave,
  canvasRef,
}) {
  const s = settings || { mouseSensitivityX: 0.9, mouseSensitivityY: 0.9, invertY: false };

  useEffect(() => {
    if (!open) return;
    if (canvasRef?.current && document.pointerLockElement === canvasRef.current) {
      document.exitPointerLock?.();
    }
  }, [open, canvasRef]);

  const update = (partial) => {
    const next = { ...s, ...partial };
    onSave?.(next);
  };

  if (!open) return null;

  return (
    <div style={OVERLAY}>
      <div style={CARD}>
        <h2 style={TITLE}>Look settings</h2>

        <div style={ROW}>
          <label style={LABEL}>Sensitivity X</label>
          <input
            type="range"
            min={0.1}
            max={3}
            step={0.05}
            value={Number(s.mouseSensitivityX) || 0.9}
            onChange={(e) => update({ mouseSensitivityX: parseFloat(e.target.value) })}
            style={SLIDER}
          />
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{Number(s.mouseSensitivityX)?.toFixed(2) ?? "0.90"}</span>
        </div>

        <div style={ROW}>
          <label style={LABEL}>Sensitivity Y</label>
          <input
            type="range"
            min={0.1}
            max={3}
            step={0.05}
            value={Number(s.mouseSensitivityY) || 0.9}
            onChange={(e) => update({ mouseSensitivityY: parseFloat(e.target.value) })}
            style={SLIDER}
          />
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{Number(s.mouseSensitivityY)?.toFixed(2) ?? "0.90"}</span>
        </div>

        <div style={TOGGLE_ROW}>
          <span style={LABEL}>Invert Y</span>
          <button
            type="button"
            onClick={() => update({ invertY: !s.invertY })}
            style={{
              ...BTN,
              background: s.invertY ? "var(--accent)" : "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              padding: "8px 14px",
            }}
          >
            {s.invertY ? "On" : "Off"}
          </button>
        </div>

        <button type="button" style={BTN_PRIMARY} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

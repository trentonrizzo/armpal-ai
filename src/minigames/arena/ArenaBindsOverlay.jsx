/**
 * ArmPal Arena — remap keyboard/gamepad/mobile binds. Reset to default, validate duplicates.
 */
import React, { useState, useEffect } from "react";
import { getArenaBinds, saveArenaBinds, getDefaultArenaBinds } from "./arenaDb";
import { useToast } from "../../components/ToastProvider";

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.92)",
  zIndex: 1001,
  overflow: "auto",
  color: "var(--text)",
  padding: "20px 16px 100px",
};
const title = { fontSize: 20, fontWeight: 900, marginBottom: 8 };
const sectionTitle = { fontSize: 12, fontWeight: 800, marginBottom: 8, color: "var(--text-dim)" };
const row = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 };
const label = { fontSize: 13, fontWeight: 600 };
const keyBox = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card-2)",
  color: "var(--text)",
  fontSize: 12,
  minWidth: 90,
};
const btn = {
  padding: 12,
  borderRadius: 10,
  border: "none",
  background: "var(--accent)",
  color: "var(--text)",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  marginTop: 12,
};
const btnSecondary = { ...btn, background: "var(--card-2)", border: "1px solid var(--border)" };

const KEYBOARD_ACTIONS = [
  "move_forward",
  "move_back",
  "move_left",
  "move_right",
  "jump",
  "sprint",
  "crouch",
  "fire",
  "aim",
  "reload",
  "weapon_1",
  "weapon_2",
  "pause",
  "camera_toggle",
];

export default function ArenaBindsOverlay({ open, onClose, userId, initialBinds, onSaved }) {
  const toast = useToast();
  const [binds, setBinds] = useState(initialBinds || getDefaultArenaBinds());
  const [listening, setListening] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBinds(initialBinds || getDefaultArenaBinds());
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getArenaBinds(userId)
      .then((b) => setBinds(b))
      .catch(() => setBinds(getDefaultArenaBinds()))
      .finally(() => setLoading(false));
  }, [open, userId, initialBinds]);

  useEffect(() => {
    if (!listening) return;
    const onKey = (e) => {
      e.preventDefault();
      const code = e.code || ("Mouse" + e.button);
      const action = listening;
      setBinds((b) => {
        const kb = { ...(b.keyboard || {}), [action]: code };
        const used = Object.entries(kb).filter(([k, v]) => v === code && k !== action);
        if (used.length > 0) {
          toast.error(`Key already used for: ${used[0][0]}`);
        }
        return { ...b, keyboard: kb };
      });
      setListening(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onKey);
    };
  }, [listening, toast]);

  const updateBind = (action, code) => {
    setBinds((b) => ({ ...b, keyboard: { ...(b.keyboard || {}), [action]: code } }));
  };

  async function handleSave() {
    if (!userId) {
      toast.error("Sign in to save binds");
      return;
    }
    const values = Object.values(binds.keyboard || {});
    const dupes = values.filter((v, i) => values.indexOf(v) !== i);
    if (dupes.length > 0) {
      toast.error("Duplicate bind detected. Change or reset to default.");
      return;
    }
    setSaving(true);
    try {
      await saveArenaBinds(userId, binds);
      onSaved?.(binds);
      toast.success("Binds saved");
      onClose?.();
    } catch (e) {
      toast.error(e?.message || "Failed to save");
    }
    setSaving(false);
  }

  function handleReset() {
    setBinds(getDefaultArenaBinds());
    toast.success("Reset to default");
  }

  if (!open) return null;

  return (
    <div style={overlay}>
      <div style={{ maxWidth: 400, margin: "0 auto" }}>
        <h2 style={title}>Controls / Binds</h2>
        <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 16 }}>
          Click a key to rebind. Duplicate binds will be warned on save.
        </p>

        {loading ? (
          <p style={{ color: "var(--text-dim)" }}>Loading…</p>
        ) : (
          <>
            <div style={sectionTitle}>KEYBOARD</div>
            {KEYBOARD_ACTIONS.map((action) => (
              <div key={action} style={row}>
                <span style={label}>{action.replace(/_/g, " ")}</span>
                <button
                  type="button"
                  style={{
                    ...keyBox,
                    borderColor: listening === action ? "var(--accent)" : undefined,
                  }}
                  onClick={() => setListening(listening === action ? null : action)}
                >
                  {listening === action ? "Press key…" : (binds.keyboard || {})[action] || "—"}
                </button>
              </div>
            ))}

            <div style={{ ...sectionTitle, marginTop: 20 }}>GAMEPAD / MOBILE</div>
            <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
              Gamepad and mobile layout remap coming soon. Use defaults for now.
            </p>

            <button type="button" onClick={handleReset} style={btnSecondary}>
              Reset to default
            </button>
            <button type="button" onClick={handleSave} disabled={saving} style={btn}>
              {saving ? "Saving…" : "Save binds"}
            </button>
            <button type="button" onClick={onClose} style={btnSecondary}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

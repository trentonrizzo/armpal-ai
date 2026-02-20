/**
 * ArmPal Arena — full settings panel (input, visual, loadout). Saved per-user to Supabase.
 */
import React, { useState, useEffect } from "react";
import { getArenaSettings, saveArenaSettings, getDefaultArenaSettings } from "./arenaDb";
import { useToast } from "../../components/ToastProvider";

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.92)",
  zIndex: 1000,
  overflow: "auto",
  color: "var(--text)",
  padding: "20px 16px 100px",
};
const title = { fontSize: 22, fontWeight: 900, marginBottom: 4 };
const sectionTitle = { fontSize: 14, fontWeight: 800, marginBottom: 12, color: "var(--text-dim)" };
const row = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 };
const label = { fontSize: 14, fontWeight: 600 };
const input = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--card-2)",
  color: "var(--text)",
  fontSize: 14,
  minWidth: 80,
};
const slider = { width: 120, accentColor: "var(--accent)" };
const btn = {
  width: "100%",
  padding: 14,
  borderRadius: 12,
  border: "none",
  background: "var(--accent)",
  color: "var(--text)",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
  marginTop: 24,
};
const btnSecondary = {
  ...btn,
  background: "var(--card-2)",
  border: "1px solid var(--border)",
  marginTop: 10,
};
const toggle = {
  width: 52,
  height: 28,
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "var(--card-2)",
  cursor: "pointer",
  padding: 2,
  display: "flex",
  justifyContent: "flex-start",
  alignItems: "center",
};
const toggleOn = { ...toggle, background: "var(--accent)", justifyContent: "flex-end" };
const toggleKnob = { width: 22, height: 22, borderRadius: 999, background: "#fff" };

export default function ArenaSettingsOverlay({ open, onClose, userId, initialSettings, onSaved }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(initialSettings || getDefaultArenaSettings());

  useEffect(() => {
    if (!open) return;
    setSettings(initialSettings || getDefaultArenaSettings());
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getArenaSettings(userId)
      .then((s) => {
        setSettings(s);
      })
      .catch(() => setSettings(getDefaultArenaSettings()))
      .finally(() => setLoading(false));
  }, [open, userId, initialSettings]);

  const update = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  async function handleSave() {
    if (!userId) {
      toast.error("Sign in to save settings");
      return;
    }
    setSaving(true);
    try {
      await saveArenaSettings(userId, settings);
      onSaved && onSaved(settings);
      toast.success("Arena settings saved");
      onClose && onClose();
    } catch (e) {
      toast.error(e?.message || "Failed to save");
    }
    setSaving(false);
  }

  if (!open) return null;

  return (
    <div style={overlay}>
      <div style={{ maxWidth: 420, margin: "0 auto" }}>
        <h1 style={title}>Arena Settings</h1>
        <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 24 }}>
          Customize controls and visuals before entering a match.
        </p>

        {loading ? (
          <p style={{ color: "var(--text-dim)" }}>Loading…</p>
        ) : (
          <>
            <div style={sectionTitle}>INPUT</div>
            <div style={row}>
              <span style={label}>Look sensitivity X</span>
              <input
                type="range"
                min="0.0005"
                max="0.008"
                step="0.00025"
                value={settings.look_sensitivity_x}
                onChange={(e) => update("look_sensitivity_x", parseFloat(e.target.value))}
                style={slider}
              />
            </div>
            <div style={row}>
              <span style={label}>Look sensitivity Y</span>
              <input
                type="range"
                min="0.0005"
                max="0.008"
                step="0.00025"
                value={settings.look_sensitivity_y}
                onChange={(e) => update("look_sensitivity_y", parseFloat(e.target.value))}
                style={slider}
              />
            </div>
            <div style={row}>
              <span style={label}>Invert Y axis</span>
              <button
                type="button"
                style={settings.invert_y_axis ? toggleOn : toggle}
                onClick={() => update("invert_y_axis", !settings.invert_y_axis)}
                aria-label="Invert Y"
              >
                <div style={toggleKnob} />
              </button>
            </div>
            <div style={row}>
              <span style={label}>ADS sensitivity</span>
              <input
                type="range"
                min="0.2"
                max="1.5"
                step="0.1"
                value={settings.ads_sensitivity}
                onChange={(e) => update("ads_sensitivity", parseFloat(e.target.value))}
                style={slider}
              />
            </div>
            <div style={row}>
              <span style={label}>Controller deadzone</span>
              <input
                type="range"
                min="0.05"
                max="0.4"
                step="0.05"
                value={settings.controller_deadzone}
                onChange={(e) => update("controller_deadzone", parseFloat(e.target.value))}
                style={slider}
              />
            </div>
            <div style={row}>
              <span style={label}>Touch drag sensitivity</span>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={settings.touch_sensitivity}
                onChange={(e) => update("touch_sensitivity", parseFloat(e.target.value))}
                style={slider}
              />
            </div>

            <div style={{ ...sectionTitle, marginTop: 24 }}>CONTROL DEVICE</div>
            <div style={row}>
              <span style={label}>Preferred input</span>
              <select
                value={settings.control_device}
                onChange={(e) => update("control_device", e.target.value)}
                style={input}
              >
                <option value="auto">Auto-detect</option>
                <option value="mouse">Mouse + Keyboard</option>
                <option value="touch">Touch</option>
                <option value="gamepad">Gamepad</option>
              </select>
            </div>

            <div style={{ ...sectionTitle, marginTop: 24 }}>MOVEMENT</div>
            <div style={row}>
              <span style={label}>Sprint toggle</span>
              <button
                type="button"
                style={settings.sprint_toggle ? toggleOn : toggle}
                onClick={() => update("sprint_toggle", !settings.sprint_toggle)}
                aria-label="Sprint toggle"
              >
                <div style={toggleKnob} />
              </button>
            </div>
            <div style={row}>
              <span style={label}>Jump button (mobile)</span>
              <select
                value={settings.jump_button_position}
                onChange={(e) => update("jump_button_position", e.target.value)}
                style={input}
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>

            <div style={{ ...sectionTitle, marginTop: 24 }}>VISUAL</div>
            <div style={row}>
              <span style={label}>FOV (60–110)</span>
              <input
                type="range"
                min="60"
                max="110"
                step="5"
                value={settings.fov}
                onChange={(e) => update("fov", parseFloat(e.target.value))}
                style={slider}
              />
            </div>
            <div style={row}>
              <span style={label}>FOV value</span>
              <span style={{ fontWeight: 700 }}>{settings.fov}°</span>
            </div>
            <div style={row}>
              <span style={label}>Crosshair style</span>
              <select
                value={settings.crosshair_style}
                onChange={(e) => update("crosshair_style", e.target.value)}
                style={input}
              >
                <option value="dot">Dot</option>
                <option value="cross">Cross</option>
                <option value="circle">Circle</option>
              </select>
            </div>

            <div style={{ ...sectionTitle, marginTop: 24 }}>LOADOUT</div>
            <div style={row}>
              <span style={label}>Character style</span>
              <select
                value={settings.character_model}
                onChange={(e) => update("character_model", e.target.value)}
                style={input}
              >
                <option value="capsule">Capsule</option>
              </select>
            </div>
            <div style={row}>
              <span style={label}>Starting weapon</span>
              <select
                value={settings.weapon_choice}
                onChange={(e) => update("weapon_choice", e.target.value)}
                style={input}
              >
                <option value="pistol">Pistol</option>
              </select>
            </div>

            <div style={row}>
              <span style={label}>Movement smoothing</span>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.05"
                value={settings.movement_smoothing}
                onChange={(e) => update("movement_smoothing", parseFloat(e.target.value))}
                style={slider}
              />
            </div>

            <button type="button" onClick={handleSave} disabled={saving} style={btn}>
              {saving ? "Saving…" : "Save settings"}
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

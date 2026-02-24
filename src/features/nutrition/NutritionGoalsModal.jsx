/**
 * Modal to set daily nutrition goals and toggle progress bars on the Nutrition page.
 */
import React, { useState, useEffect } from "react";

const OVERLAY = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.85)",
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};
const MODAL = {
  background: "#111",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 16,
  padding: 20,
  maxWidth: 400,
  width: "100%",
  color: "#fff",
};
const TITLE = {
  fontSize: 20,
  fontWeight: 800,
  marginBottom: 16,
  color: "#fff",
};
const ROW = {
  marginBottom: 12,
};
const LABEL = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "rgba(255,255,255,0.6)",
  marginBottom: 4,
};
const INPUT = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  fontSize: 15,
};
const TOGGLE_ROW = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginTop: 16,
  marginBottom: 20,
};
const TOGGLE_LABEL = {
  fontSize: 14,
  fontWeight: 600,
  color: "rgba(255,255,255,0.9)",
};
const TOGGLE = {
  width: 48,
  height: 26,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.1)",
  cursor: "pointer",
  padding: 2,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
};
const TOGGLE_ON = {
  ...TOGGLE,
  background: "var(--accent)",
  borderColor: "var(--accent)",
  justifyContent: "flex-end",
};
const KNOB = {
  width: 20,
  height: 20,
  borderRadius: 999,
  background: "#fff",
};
const ACTIONS = {
  display: "flex",
  gap: 10,
};
const BTN = {
  flex: 1,
  padding: "12px 16px",
  borderRadius: 10,
  border: "none",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
};
const BTN_CANCEL = {
  ...BTN,
  background: "rgba(255,255,255,0.1)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.2)",
};
const BTN_SAVE = {
  ...BTN,
  background: "var(--accent)",
  color: "#fff",
};

export default function NutritionGoalsModal({ open, onClose, initialGoals, onSave }) {
  const [calories_goal, setCaloriesGoal] = useState("");
  const [protein_goal, setProteinGoal] = useState("");
  const [carbs_goal, setCarbsGoal] = useState("");
  const [fat_goal, setFatGoal] = useState("");
  const [show_progress, setShowProgress] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCaloriesGoal(initialGoals?.calories_goal != null ? String(initialGoals.calories_goal) : "");
    setProteinGoal(initialGoals?.protein_goal != null ? String(initialGoals.protein_goal) : "");
    setCarbsGoal(initialGoals?.carbs_goal != null ? String(initialGoals.carbs_goal) : "");
    setFatGoal(initialGoals?.fat_goal != null ? String(initialGoals.fat_goal) : "");
    setShowProgress(initialGoals?.show_progress !== false);
  }, [open, initialGoals]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        calories_goal: calories_goal.trim() ? parseInt(calories_goal, 10) : null,
        protein_goal: protein_goal.trim() ? parseInt(protein_goal, 10) : null,
        carbs_goal: carbs_goal.trim() ? parseInt(carbs_goal, 10) : null,
        fat_goal: fat_goal.trim() ? parseInt(fat_goal, 10) : null,
        show_progress,
      });
      onClose();
    } catch (err) {
      console.error("Save goals", err);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div style={OVERLAY} onClick={onClose}>
      <div style={MODAL} onClick={(e) => e.stopPropagation()}>
        <h2 style={TITLE}>Nutrition Goals</h2>
        <form onSubmit={handleSubmit}>
          <div style={ROW}>
            <label style={LABEL}>Daily calories goal</label>
            <input
              type="number"
              min={0}
              value={calories_goal}
              onChange={(e) => setCaloriesGoal(e.target.value)}
              placeholder="Optional"
              style={INPUT}
            />
          </div>
          <div style={ROW}>
            <label style={LABEL}>Daily protein goal (g)</label>
            <input
              type="number"
              min={0}
              value={protein_goal}
              onChange={(e) => setProteinGoal(e.target.value)}
              placeholder="Optional"
              style={INPUT}
            />
          </div>
          <div style={ROW}>
            <label style={LABEL}>Daily carbs goal (g)</label>
            <input
              type="number"
              min={0}
              value={carbs_goal}
              onChange={(e) => setCarbsGoal(e.target.value)}
              placeholder="Optional"
              style={INPUT}
            />
          </div>
          <div style={ROW}>
            <label style={LABEL}>Daily fat goal (g)</label>
            <input
              type="number"
              min={0}
              value={fat_goal}
              onChange={(e) => setFatGoal(e.target.value)}
              placeholder="Optional"
              style={INPUT}
            />
          </div>
          <div style={TOGGLE_ROW}>
            <span style={TOGGLE_LABEL}>Show progress bars on Nutrition page</span>
            <button
              type="button"
              role="switch"
              aria-checked={show_progress}
              style={show_progress ? TOGGLE_ON : TOGGLE}
              onClick={() => setShowProgress((v) => !v)}
            >
              <span style={KNOB} />
            </button>
          </div>
          <div style={ACTIONS}>
            <button type="button" style={BTN_CANCEL} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" style={BTN_SAVE} disabled={saving}>
              {saving ? "Saving…" : "Save goals"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

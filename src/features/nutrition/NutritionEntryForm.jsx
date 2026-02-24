import React, { useState, useEffect } from "react";

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
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  fontSize: 15,
};
const ACTIONS = {
  display: "flex",
  gap: 10,
  marginTop: 16,
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
const BTN_PRIMARY = {
  ...BTN,
  background: "var(--accent)",
  color: "#fff",
};
const BTN_SECONDARY = {
  ...BTN,
  background: "rgba(255,255,255,0.1)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.2)",
};

export default function NutritionEntryForm({
  initial = {},
  onSubmit,
  onCancel,
  submitLabel = "Save",
}) {
  const [food_name, setFoodName] = useState(initial.food_name ?? "");
  const [calories, setCalories] = useState(String(initial.calories ?? ""));
  const [protein, setProtein] = useState(String(initial.protein ?? ""));
  const [carbs, setCarbs] = useState(String(initial.carbs ?? ""));
  const [fat, setFat] = useState(String(initial.fat ?? ""));
  const [notes, setNotes] = useState(initial.notes ?? "");

  useEffect(() => {
    setFoodName(initial.food_name ?? "");
    setCalories(String(initial.calories ?? ""));
    setProtein(String(initial.protein ?? ""));
    setCarbs(String(initial.carbs ?? ""));
    setFat(String(initial.fat ?? ""));
    setNotes(initial.notes ?? "");
  }, [initial.food_name, initial.calories, initial.protein, initial.carbs, initial.fat, initial.notes]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      food_name: food_name.trim() || null,
      calories: parseInt(calories, 10) || 0,
      protein: parseInt(protein, 10) || 0,
      carbs: parseInt(carbs, 10) || 0,
      fat: parseInt(fat, 10) || 0,
      notes: notes.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={ROW}>
        <label style={LABEL}>Food name</label>
        <input
          type="text"
          value={food_name}
          onChange={(e) => setFoodName(e.target.value)}
          placeholder="e.g. Chicken breast"
          style={INPUT}
          autoFocus
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, ...ROW }}>
        <div>
          <label style={LABEL}>Calories</label>
          <input
            type="number"
            min={0}
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            placeholder="0"
            style={INPUT}
          />
        </div>
        <div>
          <label style={LABEL}>Protein (g)</label>
          <input
            type="number"
            min={0}
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            placeholder="0"
            style={INPUT}
          />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, ...ROW }}>
        <div>
          <label style={LABEL}>Carbs (g)</label>
          <input
            type="number"
            min={0}
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
            placeholder="0"
            style={INPUT}
          />
        </div>
        <div>
          <label style={LABEL}>Fat (g)</label>
          <input
            type="number"
            min={0}
            value={fat}
            onChange={(e) => setFat(e.target.value)}
            placeholder="0"
            style={INPUT}
          />
        </div>
      </div>
      <div style={ROW}>
        <label style={LABEL}>Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. lunch"
          style={INPUT}
        />
      </div>
      <div style={ACTIONS}>
        <button type="button" style={BTN_SECONDARY} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" style={BTN_PRIMARY}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

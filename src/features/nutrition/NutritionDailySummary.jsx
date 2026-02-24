import React from "react";

const WRAP = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 20,
  padding: "20px 20px 16px",
  marginBottom: 24,
};

const ROW = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 16,
  flexWrap: "wrap",
};

const MAIN_LABEL = {
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(255,255,255,0.6)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 4,
};

const MAIN_VALUE = {
  fontSize: 36,
  fontWeight: 800,
  color: "#fff",
  lineHeight: 1.1,
};

const ACCENT_VALUE = {
  fontSize: 36,
  fontWeight: 800,
  color: "var(--accent)",
  lineHeight: 1.1,
};

const SECONDARY = {
  marginTop: 16,
  paddingTop: 16,
  borderTop: "1px solid rgba(255,255,255,0.1)",
  display: "flex",
  gap: 24,
  flexWrap: "wrap",
};

const SEC_ITEM = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const SEC_LABEL = {
  fontSize: 11,
  fontWeight: 600,
  color: "rgba(255,255,255,0.5)",
  textTransform: "uppercase",
};

const SEC_VAL = {
  fontSize: 18,
  fontWeight: 700,
  color: "rgba(255,255,255,0.9)",
};

export default function NutritionDailySummary({ totals, loading }) {
  const { calories = 0, protein = 0, carbs = 0, fat = 0 } = totals || {};

  if (loading) {
    return (
      <div style={WRAP}>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Loading totals…</p>
      </div>
    );
  }

  return (
    <div style={WRAP}>
      <div style={ROW}>
        <div>
          <div style={MAIN_LABEL}>Calories</div>
          <div style={MAIN_VALUE}>{calories}</div>
        </div>
        <div>
          <div style={MAIN_LABEL}>Protein (g)</div>
          <div style={ACCENT_VALUE}>{protein}</div>
        </div>
      </div>
      <div style={SECONDARY}>
        <div style={SEC_ITEM}>
          <span style={SEC_LABEL}>Carbs</span>
          <span style={SEC_VAL}>{carbs} g</span>
        </div>
        <div style={SEC_ITEM}>
          <span style={SEC_LABEL}>Fat</span>
          <span style={SEC_VAL}>{fat} g</span>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { fetchEntriesRange, calculateDailyTotals } from "./nutritionService";

const WRAP = {
  marginTop: 8,
};
const DAY_LIST = {
  listStyle: "none",
  margin: 0,
  padding: 0,
};
const DAY_ITEM = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "14px 16px",
  marginBottom: 8,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  cursor: "pointer",
};
const DAY_LABEL = {
  fontSize: 15,
  fontWeight: 600,
  color: "#fff",
};
const DAY_TOTALS = {
  fontSize: 13,
  color: "rgba(255,255,255,0.7)",
};
const ACCENT = { color: "var(--accent)", fontWeight: 700 };

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + "T12:00:00Z");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dMid = new Date(d);
  dMid.setHours(0, 0, 0, 0);
  const diff = Math.round((today - dMid) / (24 * 60 * 60 * 1000));
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function NutritionHistory({ userId, selectedDate, onSelectDate }) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - 30);
      const fromDate = start.toISOString().slice(0, 10);
      const toDate = end.toISOString().slice(0, 10);
      const entries = await fetchEntriesRange(userId, fromDate, toDate);
      if (!alive) return;
      const byDate = {};
      for (const e of entries) {
        if (!byDate[e.date]) byDate[e.date] = [];
        byDate[e.date].push(e);
      }
      const sorted = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
      setDays(
        sorted.map((date) => ({
          date,
          label: formatDateLabel(date),
          totals: calculateDailyTotals(byDate[date]),
        }))
      );
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [userId]);

  if (loading) {
    return (
      <div style={WRAP}>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Loading history…</p>
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div style={WRAP}>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
          No entries in the last 30 days.
        </p>
      </div>
    );
  }

  return (
    <div style={WRAP}>
      <ul style={DAY_LIST}>
        {days.map(({ date, label, totals }) => (
          <li key={date}>
            <button
              type="button"
              style={{
                ...DAY_ITEM,
                width: "100%",
                border: "none",
                textAlign: "left",
                font: "inherit",
              }}
              onClick={() => onSelectDate(date)}
            >
              <span style={DAY_LABEL}>{label}</span>
              <span style={DAY_TOTALS}>
                <span style={ACCENT}>{totals.calories}</span> cal · P {totals.protein}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

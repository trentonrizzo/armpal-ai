import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import { fetchEntriesRange, calculateDailyTotals } from "./nutritionService";
import useMultiSelect from "../../hooks/useMultiSelect";
import {
  getSelectStyle,
  SelectCheck,
  SelectionBar,
  DoubleConfirmModal,
} from "../../components/MultiSelectUI";

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
  const [allEntries, setAllEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const ms = useMultiSelect();
  const [confirmStep, setConfirmStep] = useState(0);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!userId) return;
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 30);
    const fromDate = start.toISOString().slice(0, 10);
    const toDate = end.toISOString().slice(0, 10);
    const entries = await fetchEntriesRange(userId, fromDate, toDate);
    setAllEntries(entries);
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
        entries: byDate[date],
      }))
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    let alive = true;
    loadData().then(() => { if (!alive) return; });
    return () => { alive = false; };
  }, [loadData]);

  function handleCardClick(day) {
    if (ms.active) {
      day.entries.forEach((e) => ms.toggle(e.id));
      return;
    }
    if (ms.consumeLP()) return;
    onSelectDate(day.date);
  }

  function handlePointerDown(day, e) {
    if (day.entries.length > 0) {
      ms.onPointerDown(day.entries[0].id, e);
    }
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    try {
      const ids = [...ms.selected];
      const { error } = await supabase
        .from("nutrition_entries")
        .delete()
        .in("id", ids);
      if (error) throw error;

      // Optimistic: remove from local state
      setAllEntries((prev) => prev.filter((e) => !ms.selected.has(e.id)));
      setDays((prev) =>
        prev
          .map((d) => {
            const remaining = d.entries.filter((e) => !ms.selected.has(e.id));
            if (remaining.length === 0) return null;
            return {
              ...d,
              entries: remaining,
              totals: calculateDailyTotals(remaining),
            };
          })
          .filter(Boolean)
      );

      ms.cancel();
      setConfirmStep(0);
    } catch (err) {
      console.error("Bulk delete nutrition entries failed:", err);
      alert("Some entries failed to delete. Please try again.");
    } finally {
      setBulkDeleting(false);
    }
  }

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

  const selectedEntryIds = ms.selected;
  const totalSelected = selectedEntryIds.size;

  return (
    <div style={WRAP}>
      {ms.active && (
        <div style={SELECT_HINT}>
          Long-press to select · Tap days to toggle · {totalSelected} selected
        </div>
      )}

      <ul style={DAY_LIST}>
        {days.map(({ date, label, totals, entries: dayEntries }) => {
          const daySelectedCount = dayEntries.filter((e) => selectedEntryIds.has(e.id)).length;
          const isDaySelected = daySelectedCount > 0;

          return (
            <li key={date} style={{ position: "relative" }}>
              <SelectCheck show={isDaySelected} />
              <button
                type="button"
                style={{
                  ...DAY_ITEM,
                  width: "100%",
                  textAlign: "left",
                  font: "inherit",
                  ...getSelectStyle(ms.active, isDaySelected),
                }}
                onClick={() => handleCardClick({ date, entries: dayEntries })}
                onPointerDown={(e) => handlePointerDown({ entries: dayEntries }, e)}
                onPointerMove={ms.onPointerMove}
                onPointerUp={ms.endLP}
                onPointerCancel={ms.endLP}
              >
                <span style={DAY_LABEL}>{label}</span>
                <span style={DAY_TOTALS}>
                  <span style={ACCENT}>{totals.calories}</span> cal · P {totals.protein}
                  {ms.active && daySelectedCount > 0 && (
                    <span style={{ marginLeft: 6, color: "var(--accent)", fontWeight: 700 }}>
                      ({daySelectedCount})
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {ms.active && (
        <SelectionBar
          count={totalSelected}
          onDelete={() => setConfirmStep(1)}
          onCancel={ms.cancel}
        />
      )}

      <DoubleConfirmModal
        count={totalSelected}
        step={confirmStep}
        onCancel={() => { setConfirmStep(0); ms.cancel(); }}
        onContinue={() => setConfirmStep(2)}
        onConfirm={handleBulkDelete}
        deleting={bulkDeleting}
      />
    </div>
  );
}

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
  transition: "border-color 0.2s, background 0.2s, opacity 0.2s",
  position: "relative",
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
const SELECT_HINT = {
  fontSize: 12,
  color: "var(--accent)",
  fontWeight: 600,
  marginBottom: 10,
  textAlign: "center",
  opacity: 0.9,
};

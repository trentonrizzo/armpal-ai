import React, { useState } from "react";
import { supabase } from "../../supabaseClient";
import {
  fetchEntriesByDate,
  addEntry,
  updateEntry,
  deleteEntry,
  calculateDailyTotals,
  getNutritionGoals,
  upsertNutritionGoals,
  computeProgress,
} from "./nutritionService";
import { getIsPro } from "../../utils/usageLimits";
import NutritionDailySummary from "./NutritionDailySummary";
import NutritionHistory from "./NutritionHistory";
import NutritionEntryForm from "./NutritionEntryForm";
import NutritionGoalsModal from "./NutritionGoalsModal";
import SmartFoodScanOverlay from "./SmartFoodScanOverlay";
import { Camera } from "lucide-react";

const PAGE = {
  minHeight: "100vh",
  background: "#000",
  color: "#fff",
  padding: "16px 16px 100px",
  maxWidth: 480,
  margin: "0 auto",
};

const HEADER = {
  fontSize: 24,
  fontWeight: 800,
  marginBottom: 4,
  color: "#fff",
};
const SUB = {
  fontSize: 14,
  color: "rgba(255,255,255,0.6)",
  marginBottom: 20,
};

const SECTION_TITLE = {
  fontSize: 14,
  fontWeight: 700,
  color: "rgba(255,255,255,0.7)",
  marginBottom: 10,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const CARD = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 16,
  padding: 16,
  marginBottom: 16,
};

const BTN_PRIMARY = {
  width: "100%",
  padding: "14px 20px",
  borderRadius: 12,
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
};

const HEADER_ROW = {
  display: "flex",
  gap: 10,
  marginBottom: 20,
  alignItems: "center",
};
const DATE_INPUT = {
  flex: 1,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  fontSize: 15,
};
const HEADER_BTN = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const PROGRESS_SECTION = {
  marginBottom: 24,
};
const PROGRESS_ROW = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 6,
  gap: 12,
};
const PROGRESS_LABEL = {
  fontSize: 13,
  fontWeight: 600,
  color: "rgba(255,255,255,0.85)",
  minWidth: 80,
};
const PROGRESS_TEXT = {
  fontSize: 12,
  color: "rgba(255,255,255,0.6)",
};
const PROGRESS_BAR_BG = {
  height: 6,
  borderRadius: 3,
  background: "rgba(255,255,255,0.1)",
  overflow: "hidden",
  marginTop: 4,
};
const PROGRESS_BAR_FILL = (pct) => ({
  width: `${Math.min(100, pct * 100)}%`,
  height: "100%",
  background: "var(--accent)",
  borderRadius: 3,
  transition: "width 0.2s ease",
});

export default function NutritionPage() {
  const [user, setUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [goals, setGoals] = useState(null);
  const [goalsModalOpen, setGoalsModalOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [isPro, setIsPro] = useState(false);

  React.useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (alive) setUser(u ?? null);
    });
    return () => { alive = false; };
  }, []);

  React.useEffect(() => {
    if (!user?.id) return;
    getIsPro(user.id).then(setIsPro);
  }, [user?.id]);

  const loadEntries = React.useCallback(async () => {
    if (!user?.id || !selectedDate) return;
    setLoading(true);
    try {
      const list = await fetchEntriesByDate(user.id, selectedDate);
      setEntries(list);
    } catch (e) {
      console.error("Load entries", e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedDate]);

  const loadGoals = React.useCallback(async () => {
    if (!user?.id) return;
    try {
      const g = await getNutritionGoals(user.id);
      setGoals(g);
    } catch (e) {
      console.error("Load goals", e);
    }
  }, [user?.id]);

  React.useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  React.useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const totals = calculateDailyTotals(entries);

  const handleAdd = async (data) => {
    if (!user?.id) return;
    await addEntry({
      user_id: user.id,
      date: selectedDate,
      ...data,
    });
    setFormOpen(false);
    loadEntries();
  };

  const handleUpdate = async (id, data) => {
    await updateEntry(id, data);
    setEditingId(null);
    loadEntries();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this entry?")) return;
    await deleteEntry(id);
    setEditingId(null);
    loadEntries();
  };

  const handleSaveGoals = async (goalsData) => {
    if (!user?.id) return;
    await upsertNutritionGoals(user.id, goalsData);
    await loadGoals();
  };

  const openEdit = (entry) => {
    setEditingId(entry.id);
  };

  const showProgressBars = goals?.show_progress === true;
  const hasAnyGoal =
    (goals?.calories_goal != null && goals.calories_goal > 0) ||
    (goals?.protein_goal != null && goals.protein_goal > 0) ||
    (goals?.carbs_goal != null && goals.carbs_goal > 0) ||
    (goals?.fat_goal != null && goals.fat_goal > 0);

  const progressRows = [];
  if (showProgressBars && hasAnyGoal) {
    if (goals?.calories_goal != null && goals.calories_goal > 0) {
      const p = computeProgress(totals.calories, goals.calories_goal);
      progressRows.push({
        label: "Calories",
        current: totals.calories,
        goal: goals.calories_goal,
        progress: p,
      });
    }
    if (goals?.protein_goal != null && goals.protein_goal > 0) {
      const p = computeProgress(totals.protein, goals.protein_goal);
      progressRows.push({
        label: "Protein",
        current: totals.protein,
        goal: goals.protein_goal,
        progress: p,
      });
    }
    if (goals?.carbs_goal != null && goals.carbs_goal > 0) {
      const p = computeProgress(totals.carbs, goals.carbs_goal);
      progressRows.push({
        label: "Carbs",
        current: totals.carbs,
        goal: goals.carbs_goal,
        progress: p,
      });
    }
    if (goals?.fat_goal != null && goals.fat_goal > 0) {
      const p = computeProgress(totals.fat, goals.fat_goal);
      progressRows.push({
        label: "Fat",
        current: totals.fat,
        goal: goals.fat_goal,
        progress: p,
      });
    }
  }

  if (!user) {
    return (
      <div style={PAGE}>
        <p style={{ color: "rgba(255,255,255,0.7)" }}>Loading…</p>
      </div>
    );
  }

  if (showHistory) {
    return (
      <div style={PAGE}>
        <button
          type="button"
          onClick={() => setShowHistory(false)}
          style={{
            background: "none",
            border: "none",
            color: "var(--accent)",
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 16,
            cursor: "pointer",
          }}
        >
          ← Back to today
        </button>
        <h1 style={HEADER}>History</h1>
        <p style={SUB}>Tap a day to see entries</p>
        <NutritionHistory
          userId={user.id}
          selectedDate={selectedDate}
          onSelectDate={(date) => {
            setSelectedDate(date);
            setShowHistory(false);
          }}
        />
      </div>
    );
  }

  return (
    <div style={PAGE}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ ...HEADER, marginBottom: 0 }}>Nutrition</h1>
        <button
          type="button"
          onClick={() => setScanOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Camera size={16} />
          <span>Scan</span>
          <span style={{
            fontSize: 9,
            fontWeight: 800,
            color: "#000",
            background: "var(--accent)",
            padding: "2px 5px",
            borderRadius: 4,
            lineHeight: 1,
          }}>PRO</span>
        </button>
      </div>
      <p style={SUB}>Track daily calories and macros</p>

      <div style={HEADER_ROW}>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={DATE_INPUT}
        />
        <button
          type="button"
          onClick={() => setShowHistory(true)}
          style={HEADER_BTN}
        >
          History
        </button>
        <button
          type="button"
          onClick={() => setGoalsModalOpen(true)}
          style={HEADER_BTN}
        >
          Goals
        </button>
      </div>

      <NutritionDailySummary totals={totals} loading={loading} />

      {showProgressBars && progressRows.length > 0 && (
        <div style={PROGRESS_SECTION}>
          {progressRows.map((row) => (
            <div key={row.label} style={{ marginBottom: 10 }}>
              <div style={PROGRESS_ROW}>
                <span style={PROGRESS_LABEL}>{row.label}</span>
                <span style={PROGRESS_TEXT}>
                  {row.current} / {row.goal}
                </span>
              </div>
              <div style={PROGRESS_BAR_BG}>
                <div
                  style={PROGRESS_BAR_FILL(row.progress ?? 0)}
                  role="progressbar"
                  aria-valuenow={row.current}
                  aria-valuemin={0}
                  aria-valuemax={row.goal}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={SECTION_TITLE}>Entries</div>
      <div style={CARD}>
        {loading ? (
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Loading…</p>
        ) : entries.length === 0 ? (
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
            No entries for this day. Add one below.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {entries.map((entry) => (
              <li
                key={entry.id}
                style={{
                  padding: "12px 0",
                  borderBottom:
                    entries.indexOf(entry) < entries.length - 1
                      ? "1px solid rgba(255,255,255,0.08)"
                      : "none",
                }}
              >
                {editingId === entry.id ? (
                  <NutritionEntryForm
                    initial={{
                      food_name: entry.food_name,
                      calories: entry.calories,
                      protein: entry.protein,
                      carbs: entry.carbs,
                      fat: entry.fat,
                      notes: entry.notes,
                    }}
                    onSubmit={(data) => handleUpdate(entry.id, data)}
                    onCancel={() => setEditingId(null)}
                    submitLabel="Save"
                  />
                ) : (
                  <>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      {entry.food_name || "Unnamed"}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "rgba(255,255,255,0.7)",
                        marginBottom: 8,
                      }}
                    >
                      {entry.calories} cal · P {entry.protein} · C {entry.carbs} · F {entry.fat}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => openEdit(entry)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: "1px solid var(--accent)",
                          background: "transparent",
                          color: "var(--accent)",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.id)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: "1px solid rgba(255,255,255,0.3)",
                          background: "transparent",
                          color: "rgba(255,255,255,0.8)",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!formOpen && !editingId && (
        <button type="button" style={BTN_PRIMARY} onClick={() => setFormOpen(true)}>
          + Add entry
        </button>
      )}

      {formOpen && (
        <div style={{ ...CARD, marginTop: 16 }}>
          <NutritionEntryForm
            initial={{}}
            onSubmit={handleAdd}
            onCancel={() => setFormOpen(false)}
            submitLabel="Add entry"
          />
        </div>
      )}

      <NutritionGoalsModal
        open={goalsModalOpen}
        onClose={() => setGoalsModalOpen(false)}
        initialGoals={goals}
        onSave={handleSaveGoals}
      />

      <SmartFoodScanOverlay
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        userId={user?.id}
        selectedDate={selectedDate}
        isPro={isPro}
        onSaved={loadEntries}
      />
    </div>
  );
}

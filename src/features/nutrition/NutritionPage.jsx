import React, { useState } from "react";
import { supabase } from "../../supabaseClient";
import {
  fetchEntriesByDate,
  addEntry,
  updateEntry,
  deleteEntry,
  calculateDailyTotals,
} from "./nutritionService";
import NutritionDailySummary from "./NutritionDailySummary";
import NutritionHistory from "./NutritionHistory";
import NutritionEntryForm from "./NutritionEntryForm";

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

  React.useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (alive) setUser(u ?? null);
    });
    return () => { alive = false; };
  }, []);

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

  React.useEffect(() => {
    loadEntries();
  }, [loadEntries]);

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

  const openEdit = (entry) => {
    setEditingId(entry.id);
  };

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
      <h1 style={HEADER}>Nutrition</h1>
      <p style={SUB}>Track daily calories and macros</p>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={{
            flex: 1,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            fontSize: 15,
          }}
        />
        <button
          type="button"
          onClick={() => setShowHistory(true)}
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          History
        </button>
      </div>

      <NutritionDailySummary totals={totals} loading={loading} />

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
    </div>
  );
}

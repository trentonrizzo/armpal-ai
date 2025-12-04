// src/pages/GoalsPage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function GoalsPage() {
  const [goals, setGoals] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [editingGoal, setEditingGoal] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Fields for NEW or EDIT goal
  const [title, setTitle] = useState("");
  const [type, setType] = useState("custom");
  const [currentValue, setCurrentValue] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) throw error;

      setUser(user);
      if (user) await loadGoals(user.id);
    } catch (err) {
      console.error("Error loading user:", err);
    }
  }

  async function loadGoals(uid) {
    try {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", uid)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      setGoals(data || []);
    } catch (err) {
      console.error("Error loading goals:", err.message);
    } finally {
      setLoading(false);
    }
  }

  function openModal(goal = null) {
    if (goal) {
      setEditingGoal(goal);
      setTitle(goal.title);
      setType(goal.type);
      setCurrentValue(goal.current_value ?? "");
      setTargetValue(goal.target_value ?? "");
      setUnit(goal.unit ?? "");
    } else {
      setEditingGoal(null);
      setTitle("");
      setType("custom");
      setCurrentValue("");
      setTargetValue("");
      setUnit("");
    }
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  async function saveGoal() {
    try {
      if (!user) return;

      const payload = {
        user_id: user.id,
        title,
        type,
        current_value: currentValue ? Number(currentValue) : null,
        target_value: targetValue ? Number(targetValue) : null,
        unit,
        updated_at: new Date(),
      };

      let res;
      if (editingGoal) {
        // Update existing
        res = await supabase
          .from("goals")
          .update(payload)
          .eq("id", editingGoal.id);
      } else {
        // Insert new
        res = await supabase.from("goals").insert(payload);
      }

      if (res.error) throw res.error;

      closeModal();
      await loadGoals(user.id);
    } catch (err) {
      console.error("Save goal error:", err.message);
    }
  }

  async function deleteGoal(id) {
    try {
      const { error } = await supabase
        .from("goals")
        .delete()
        .eq("id", id);

      if (error) throw error;

      await loadGoals(user.id);
    } catch (err) {
      console.error("Delete error:", err.message);
    }
  }

  return (
    <div
      style={{
        padding: "20px 16px 90px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      <h1
        style={{
          fontSize: "22px",
          fontWeight: 700,
          marginBottom: "16px",
        }}
      >
        Goals
      </h1>

      {/* Add New Goal Button */}
      <button
        onClick={() => openModal(null)}
        style={{
          width: "100%",
          padding: "12px",
          background: "#ff2f2f",
          color: "white",
          borderRadius: "10px",
          border: "none",
          fontSize: "15px",
          fontWeight: 600,
          marginBottom: "16px",
          cursor: "pointer",
        }}
      >
        + Add New Goal
      </button>

      {loading ? (
        <p style={{ opacity: 0.7 }}>Loading goals...</p>
      ) : goals.length === 0 ? (
        <p style={{ opacity: 0.7 }}>No goals yet. Add your first one!</p>
      ) : (
        goals.map((goal) => {
          const progress = Number(goal.progress || 0).toFixed(0);

          return (
            <div
              key={goal.id}
              style={{
                background: "#101010",
                borderRadius: "12px",
                padding: "14px",
                border: "1px solid rgba(255,255,255,0.07)",
                marginBottom: "14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: "15px",
                      fontWeight: 600,
                      margin: 0,
                    }}
                  >
                    {goal.title}
                  </p>
                  <p
                    style={{
                      fontSize: "12px",
                      opacity: 0.7,
                      margin: 0,
                    }}
                  >
                    {goal.current_value ?? 0} /{" "}
                    {goal.target_value ?? "?"} {goal.unit}
                  </p>
                </div>
                <strong style={{ fontSize: "13px", opacity: 0.9 }}>
                  {progress}%
                </strong>
              </div>

              {/* Progress bar */}
              <div
                style={{
                  width: "100%",
                  height: "6px",
                  borderRadius: "999px",
                  background: "rgba(255,255,255,0.05)",
                  overflow: "hidden",
                  marginBottom: "10px",
                }}
              >
                <div
                  style={{
                    width: `${progress}%`,
                    height: "100%",
                    background:
                      "linear-gradient(90deg, #ff2f2f, #ff6b4a)",
                    borderRadius: "999px",
                    transition: "width 0.2s ease",
                  }}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => openModal(goal)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "#111",
                    color: "white",
                    borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.12)",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  Edit
                </button>

                <button
                  onClick={() => deleteGoal(goal.id)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "transparent",
                    color: "#ff2f2f",
                    borderRadius: "8px",
                    border: "1px solid rgba(255,0,0,0.4)",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })
      )}

      {/* EDIT / ADD MODAL */}
      {modalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px",
            zIndex: 999,
          }}
          onClick={closeModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0f0f0f",
              padding: "18px",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "420px",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: "18px",
                fontWeight: 600,
              }}
            >
              {editingGoal ? "Edit Goal" : "Create Goal"}
            </h2>

            {/* Title */}
            <label style={{ fontSize: "12px", opacity: 0.9 }}>
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                marginBottom: "10px",
                background: "#111",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "white",
              }}
            />

            {/* Type */}
            <label style={{ fontSize: "12px", opacity: 0.9 }}>
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                marginBottom: "10px",
                background: "#111",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "white",
              }}
            >
              <option value="custom">Custom</option>
              <option value="pr">PR</option>
              <option value="measurement">Measurement</option>
            </select>

            {/* Current Value */}
            <label style={{ fontSize: "12px", opacity: 0.9 }}>
              Current Value
            </label>
            <input
              type="number"
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                marginBottom: "10px",
                background: "#111",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "white",
              }}
            />

            {/* Target Value */}
            <label style={{ fontSize: "12px", opacity: 0.9 }}>
              Target Value
            </label>
            <input
              type="number"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                marginBottom: "10px",
                background: "#111",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "white",
              }}
            />

            {/* Unit */}
            <label style={{ fontSize: "12px", opacity: 0.9 }}>
              Unit (optional)
            </label>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                marginBottom: "16px",
                background: "#111",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "white",
              }}
            />

            {/* Save */}
            <button
              onClick={saveGoal}
              style={{
                width: "100%",
                padding: "12px",
                background: "#ff2f2f",
                color: "white",
                borderRadius: "10px",
                border: "none",
                fontSize: "15px",
                fontWeight: 600,
                marginBottom: "10px",
                cursor: "pointer",
              }}
            >
              Save Goal
            </button>

            {/* Cancel */}
            <button
              onClick={closeModal}
              style={{
                width: "100%",
                padding: "10px",
                background: "#222",
                color: "white",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.1)",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

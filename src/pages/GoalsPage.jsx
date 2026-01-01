// src/pages/GoalsPage.jsx
// ============================================================
// ARM PAL — GOALS PAGE (FULL, SAFE, FIXED SAVING + RED THEME)
// ============================================================

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { FaEdit, FaTrash } from "react-icons/fa";

/* ============================================================
   SORTABLE WRAPPER (LEFT HANDLE 40% ONLY)
============================================================ */
function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        position: "relative",
      }}
    >
      {/* INVISIBLE DRAG HANDLE — LEFT 40% ONLY */}
      <div
        {...attributes}
        {...listeners}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "40%",
          height: "100%",
          zIndex: 6,
          touchAction: "none",
        }}
      />
      {children}
    </div>
  );
}

/* ============================================================
   MAIN PAGE
============================================================ */
export default function GoalsPage() {
  const [goals, setGoals] = useState([]);
  const [order, setOrder] = useState([]);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);

  // form fields
  const [title, setTitle] = useState("");
  const [type, setType] = useState("custom"); // custom | bodyweight | strength
  const [currentValue, setCurrentValue] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");

  // errors / saving
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // delete confirm
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  /* ============================================================
     LOAD USER + GOALS
  ============================================================ */
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      const u = data?.user || null;
      setUser(u);

      if (u && !error) {
        await loadGoals(u.id);
      }
      setLoading(false);
    })();
  }, []);

  async function loadGoals(uid) {
    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", uid)
      .order("updated_at", { ascending: false });

    if (error) {
      setGoals([]);
      setOrder([]);
      return;
    }

    setGoals(data || []);
    setOrder((data || []).map((g) => g.id));
  }

  /* ============================================================
     REORDER
  ============================================================ */
  function onDragEnd(e) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = order.indexOf(active.id);
    const newIndex = order.indexOf(over.id);

    const newOrder = arrayMove(order, oldIndex, newIndex);
    setOrder(newOrder);
  }

  /* ============================================================
     MODAL OPEN/CLOSE
  ============================================================ */
  function openModal(goal = null) {
    setFormError("");

    if (goal) {
      setEditingGoal(goal);
      setTitle(goal.title ?? "");
      setType(goal.type ?? "custom");
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
    if (saving) return;
    setModalOpen(false);
  }

  /* ============================================================
     SAVE GOAL (FIXED: ISO TIMESTAMP + ERROR DISPLAY)
  ============================================================ */
  async function saveGoal() {
    setFormError("");
    if (!user?.id) return setFormError("Not logged in.");

    // hard rules
    const finalType = type || "custom";
    const finalUnit =
      finalType === "bodyweight" ? "lb" : (unit || "").trim();

    const finalTitle =
      (title || "").trim() ||
      (finalType === "bodyweight" ? "Bodyweight" : "");

    // minimal validation
    if (!finalTitle) return setFormError("Title is required.");
    if (targetValue === "" || targetValue === null)
      return setFormError("Target value is required.");

    // bodyweight: current is optional, but nice
    const cur =
      currentValue === "" || currentValue === null
        ? null
        : Number(currentValue);
    const tgt = Number(targetValue);

    if (Number.isNaN(tgt)) return setFormError("Target value must be a number.");
    if (cur !== null && Number.isNaN(cur))
      return setFormError("Current value must be a number.");

    if (finalType !== "bodyweight" && !finalUnit) {
      return setFormError("Unit is required.");
    }

    setSaving(true);

    const payload = {
      user_id: user.id,
      title: finalTitle,
      type: finalType,
      current_value: cur,
      target_value: tgt,
      unit: finalUnit,
      // FIX: Supabase timestamp should be ISO string
      updated_at: new Date().toISOString(),
    };

    let res;
    if (editingGoal?.id) {
      res = await supabase
        .from("goals")
        .update(payload)
        .eq("id", editingGoal.id)
        .select()
        .maybeSingle();
    } else {
      res = await supabase.from("goals").insert(payload).select().maybeSingle();
    }

    const { error } = res || {};
    if (error) {
      setFormError(error.message || "Failed to save goal.");
      setSaving(false);
      return;
    }

    setSaving(false);
    setModalOpen(false);
    await loadGoals(user.id);
  }

  /* ============================================================
     DELETE
  ============================================================ */
  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);

    const { error } = await supabase.from("goals").delete().eq("id", deleteId);

    setDeleting(false);

    if (error) {
      // don’t close, show error in modal card style
      setFormError(error.message || "Failed to delete.");
      return;
    }

    setDeleteId(null);
    setFormError("");
    if (user) await loadGoals(user.id);
  }

  /* ============================================================
     ORDERED GOALS
  ============================================================ */
  const orderedGoals = useMemo(() => {
    return order
      .map((id) => goals.find((g) => g.id === id))
      .filter(Boolean);
  }, [order, goals]);

  if (loading) return <p style={{ padding: 20, opacity: 0.7 }}>Loading…</p>;

  return (
    <div
      style={{
        padding: "20px 16px 90px",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>
        Goals
      </h1>

      {/* ADD BUTTON — SOLID RED (NO ORANGE) */}
      <button
        onClick={() => openModal(null)}
        style={{
          padding: "14px 12px",
          width: "100%",
          background: "#ff2f2f",
          borderRadius: 14,
          border: "none",
          color: "white",
          fontSize: 15,
          fontWeight: 800,
          marginBottom: 18,
          boxShadow: "0 10px 30px rgba(255,47,47,0.18)",
        }}
      >
        + Add New Goal
      </button>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          {orderedGoals.map((goal) => {
            const current = Number(goal.current_value || 0);
            const target = Number(goal.target_value || 0);

            const progress =
              target > 0
                ? Math.min(
                    100,
                    Math.max(0, Math.round((current / target) * 100))
                  )
                : 0;

            return (
              <SortableItem key={goal.id} id={goal.id}>
                <div
                  style={{
                    background: "#101010",
                    borderRadius: 14,
                    padding: 16,
                    border: "1px solid rgba(255,255,255,0.08)",
                    marginBottom: 14,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 10,
                    }}
                  >
                    <div style={{ flex: 1, paddingRight: 10 }}>
                      <div
                        style={{
                          margin: 0,
                          fontSize: 16,
                          fontWeight: 800,
                          lineHeight: "20px",
                        }}
                      >
                        {goal.title}
                      </div>

                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                          opacity: 0.75,
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        <span>
                          {current} / {target} {goal.unit}
                        </span>

                        {goal.type === "bodyweight" && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: "4px 8px",
                              borderRadius: 999,
                              background: "rgba(255,47,47,0.16)",
                              border: "1px solid rgba(255,47,47,0.28)",
                              color: "#fff",
                            }}
                          >
                            Bodyweight
                          </span>
                        )}

                        {goal.type === "strength" && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: "4px 8px",
                              borderRadius: 999,
                              background: "rgba(255,255,255,0.08)",
                              border: "1px solid rgba(255,255,255,0.12)",
                              color: "#fff",
                            }}
                          >
                            Strength
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 14,
                        paddingLeft: 10,
                        pointerEvents: "auto",
                      }}
                    >
                      <FaEdit
                        style={{ cursor: "pointer", fontSize: 16 }}
                        onClick={() => openModal(goal)}
                      />
                      <FaTrash
                        style={{
                          cursor: "pointer",
                          color: "#ff4d4d",
                          fontSize: 16,
                        }}
                        onClick={() => {
                          setFormError("");
                          setDeleteId(goal.id);
                        }}
                      />
                    </div>
                  </div>

                  {/* PROGRESS BAR */}
                  <div style={{ marginTop: 14 }}>
                    <div
                      style={{
                        height: 7,
                        width: "100%",
                        background: "rgba(255,255,255,0.06)",
                        borderRadius: 999,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${progress}%`,
                          height: "100%",
                          background: "#ff2f2f",
                          borderRadius: 999,
                          transition: "width 0.25s ease",
                          boxShadow: "0 0 18px rgba(255,47,47,0.20)",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        marginTop: 8,
                        fontSize: 13,
                        opacity: 0.85,
                        fontWeight: 800,
                      }}
                    >
                      {progress}%
                    </div>
                  </div>
                </div>
              </SortableItem>
            );
          })}
        </SortableContext>
      </DndContext>

      {/* ========================= MODAL: ADD/EDIT ========================= */}
      {modalOpen && (
        <div style={backdrop} onClick={closeModal}>
          <div style={card} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, fontSize: 22, fontWeight: 900 }}>
              {editingGoal ? "Edit Goal" : "New Goal"}
            </h2>

            {formError ? (
              <div
                style={{
                  background: "rgba(255,47,47,0.12)",
                  border: "1px solid rgba(255,47,47,0.25)",
                  color: "#fff",
                  padding: 10,
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                {formError}
              </div>
            ) : null}

            <label style={label}>Title</label>
            <input
              style={input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bench, Squat, Bodyweight, etc."
            />

            <label style={label}>Goal Type</label>
            <select
              style={input}
              value={type}
              onChange={(e) => {
                const next = e.target.value;
                setType(next);

                // Bodyweight: lock unit
                if (next === "bodyweight") {
                  setUnit("lb");
                  if (!title.trim()) setTitle("Bodyweight");
                }
              }}
            >
              <option value="custom">Custom</option>
              <option value="bodyweight">Bodyweight</option>
              <option value="strength">Strength</option>
            </select>

            <label style={label}>Current Value</label>
            <input
              style={input}
              type="number"
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              placeholder={type === "bodyweight" ? "188" : "315"}
            />

            <label style={label}>Target Value</label>
            <input
              style={input}
              type="number"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder={type === "bodyweight" ? "180" : "405"}
            />

            <label style={label}>Unit</label>
            <input
              style={{
                ...input,
                opacity: type === "bodyweight" ? 0.7 : 1,
              }}
              value={type === "bodyweight" ? "lb" : unit}
              disabled={type === "bodyweight"}
              onChange={(e) => setUnit(e.target.value)}
              placeholder={type === "bodyweight" ? "lb" : "lb"}
            />

            <button
              style={{
                ...saveBtn,
                background: saving ? "#444" : "#ff2f2f",
                cursor: saving ? "not-allowed" : "pointer",
              }}
              onClick={saveGoal}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Goal"}
            </button>

            <button
              style={{
                ...cancelBtn,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.6 : 1,
              }}
              onClick={closeModal}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ========================= CONFIRM DELETE ========================= */}
      {deleteId && (
        <div style={backdrop} onClick={() => (deleting ? null : setDeleteId(null))}>
          <div style={card} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, color: "#ff4d4d", fontWeight: 900 }}>
              Confirm Delete?
            </h2>
            <p style={{ opacity: 0.75, marginTop: 6 }}>
              This action cannot be undone.
            </p>

            {formError ? (
              <div
                style={{
                  background: "rgba(255,47,47,0.12)",
                  border: "1px solid rgba(255,47,47,0.25)",
                  color: "#fff",
                  padding: 10,
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 700,
                  marginTop: 10,
                }}
              >
                {formError}
              </div>
            ) : null}

            <button
              style={{
                ...cancelBtn,
                cursor: deleting ? "not-allowed" : "pointer",
                opacity: deleting ? 0.6 : 1,
              }}
              onClick={() => setDeleteId(null)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              style={{
                ...deleteBtn,
                background: deleting ? "#444" : "#ff2f2f",
                cursor: deleting ? "not-allowed" : "pointer",
              }}
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   STYLES
============================================================ */
const backdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.65)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 20,
  zIndex: 999,
};

const card = {
  background: "#111",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  padding: 18,
  width: "100%",
  maxWidth: 440,
};

const input = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  background: "#000",
  border: "1px solid rgba(255,255,255,0.15)",
  color: "white",
  marginBottom: 12,
  fontSize: 14,
};

const label = {
  fontSize: 12,
  opacity: 0.85,
  marginBottom: 6,
  display: "block",
  fontWeight: 700,
};

const saveBtn = {
  width: "100%",
  padding: 12,
  borderRadius: 14,
  background: "#ff2f2f",
  color: "white",
  border: "none",
  fontWeight: 900,
  marginBottom: 10,
};

const cancelBtn = {
  width: "100%",
  padding: 12,
  borderRadius: 14,
  background: "#333",
  color: "white",
  border: "none",
  marginBottom: 10,
  fontWeight: 800,
};

const deleteBtn = {
  width: "100%",
  padding: 12,
  borderRadius: 14,
  background: "#ff2f2f",
  color: "white",
  border: "none",
  fontWeight: 900,
};

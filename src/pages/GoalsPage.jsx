// src/pages/GoalsPage.jsx
// ============================================================
// ARM PAL — GOALS PAGE (FULL, EXTENDED, SAFE VERSION)
// ============================================================

import React, { useEffect, useState, useMemo } from "react";
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
   SORTABLE ITEM (LEFT 40% DRAG ZONE — LOCKED)
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
      {/* DRAG HANDLE (LEFT SIDE ONLY) */}
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
   MAIN GOALS PAGE
============================================================ */
export default function GoalsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [goals, setGoals] = useState([]);
  const [order, setOrder] = useState([]);

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);

  // form
  const [title, setTitle] = useState("");
  const [type, setType] = useState("custom"); // custom | bodyweight | strength
  const [currentValue, setCurrentValue] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");

  // delete confirm
  const [deleteId, setDeleteId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  /* ============================================================
     LOAD USER + GOALS
  ============================================================ */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user;
      setUser(u);
      if (u) await loadGoals(u.id);
      setLoading(false);
    })();
  }, []);

  async function loadGoals(uid) {
    const { data } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", uid)
      .order("updated_at", { ascending: false });

    setGoals(data || []);
    setOrder((data || []).map((g) => g.id));
  }

  /* ============================================================
     DRAG / REORDER
  ============================================================ */
  function onDragEnd(e) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = order.indexOf(active.id);
    const newIndex = order.indexOf(over.id);

    setOrder(arrayMove(order, oldIndex, newIndex));
  }

  /* ============================================================
     MODAL CONTROL
  ============================================================ */
  function openModal(goal = null) {
    if (goal) {
      setEditingGoal(goal);
      setTitle(goal.title);
      setType(goal.type || "custom");
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
    if (!user) return;

    const payload = {
      user_id: user.id,
      title,
      type,
      current_value: currentValue !== "" ? Number(currentValue) : null,
      target_value: targetValue !== "" ? Number(targetValue) : null,
      unit,
      updated_at: new Date(),
    };

    if (editingGoal) {
      await supabase.from("goals").update(payload).eq("id", editingGoal.id);
    } else {
      await supabase.from("goals").insert(payload);
    }

    closeModal();
    await loadGoals(user.id);
  }

  async function confirmDelete() {
    await supabase.from("goals").delete().eq("id", deleteId);
    setDeleteId(null);
    if (user) await loadGoals(user.id);
  }

  /* ============================================================
     DERIVED VALUES
  ============================================================ */
  const orderedGoals = useMemo(
    () => order.map((id) => goals.find((g) => g.id === id)).filter(Boolean),
    [order, goals]
  );

  if (loading)
    return <p style={{ padding: 20, opacity: 0.7 }}>Loading…</p>;

  /* ============================================================
     RENDER
  ============================================================ */
  return (
    <div
      style={{
        padding: "20px 16px 110px",
        maxWidth: 960,
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>
        Goals
      </h1>

      {/* ADD BUTTON */}
      <button
        onClick={() => openModal(null)}
        style={{
          width: "100%",
          padding: 14,
          borderRadius: 12,
          background: "linear-gradient(90deg,#ff2f2f,#ff6b4a)",
          border: "none",
          color: "#fff",
          fontWeight: 700,
          marginBottom: 18,
        }}
      >
        + Add New Goal
      </button>

      {/* GOALS LIST */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={order}
          strategy={verticalListSortingStrategy}
        >
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
                  }}
                >
                  {/* HEADER */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          marginBottom: 2,
                        }}
                      >
                        {goal.title}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          opacity: 0.75,
                        }}
                      >
                        {current} / {target} {goal.unit}
                        {goal.type === "bodyweight" && " • Bodyweight"}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 14 }}>
                      <FaEdit
                        style={{ cursor: "pointer" }}
                        onClick={() => openModal(goal)}
                      />
                      <FaTrash
                        style={{ cursor: "pointer", color: "#ff4d4d" }}
                        onClick={() => setDeleteId(goal.id)}
                      />
                    </div>
                  </div>

                  {/* PROGRESS */}
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
                          background:
                            "linear-gradient(90deg,#ff2f2f,#ff6b4a)",
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 13,
                        textAlign: "right",
                        opacity: 0.85,
                        fontWeight: 600,
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

      {/* ========================================================
         MODAL — ADD / EDIT
      ======================================================== */}
      {modalOpen && (
        <div style={backdrop} onClick={closeModal}>
          <div style={card} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>
              {editingGoal ? "Edit Goal" : "New Goal"}
            </h2>

            <label style={label}>Title</label>
            <input
              style={input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <label style={label}>Goal Type</label>
            <select
              style={input}
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                if (e.target.value === "bodyweight") setUnit("lb");
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
            />

            <label style={label}>Target Value</label>
            <input
              style={input}
              type="number"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
            />

            <label style={label}>Unit</label>
            <input
              style={input}
              value={unit}
              disabled={type === "bodyweight"}
              onChange={(e) => setUnit(e.target.value)}
            />

            <button style={saveBtn} onClick={saveGoal}>
              Save Goal
            </button>
            <button style={cancelBtn} onClick={closeModal}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
         DELETE CONFIRM
      ======================================================== */}
      {deleteId && (
        <div style={backdrop} onClick={() => setDeleteId(null)}>
          <div style={card} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: "#ff4d4d" }}>Delete Goal?</h2>
            <p style={{ opacity: 0.75 }}>
              This cannot be undone.
            </p>
            <button style={cancelBtn} onClick={() => setDeleteId(null)}>
              Cancel
            </button>
            <button style={deleteBtn} onClick={confirmDelete}>
              Delete
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
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  padding: 20,
  width: "100%",
  maxWidth: 440,
};

const input = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  background: "#000",
  border: "1px solid rgba(255,255,255,0.15)",
  color: "#fff",
  marginBottom: 12,
};

const label = {
  fontSize: 12,
  opacity: 0.85,
  marginBottom: 4,
  display: "block",
};

const saveBtn = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  background: "#ff2f2f",
  color: "#fff",
  border: "none",
  fontWeight: 700,
  marginBottom: 10,
};

const cancelBtn = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  background: "#333",
  color: "#fff",
  border: "none",
  marginBottom: 10,
};

const deleteBtn = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  background: "#ff2f2f",
  color: "#fff",
  border: "none",
  fontWeight: 700,
};

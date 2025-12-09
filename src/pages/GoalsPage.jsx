// src/pages/GoalsPage.jsx
import React, { useEffect, useState } from "react";
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

/* ------------------------------
   SORTABLE WRAPPER (LEFT HANDLE)
------------------------------- */
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
          zIndex: 5,
          touchAction: "none",
        }}
      />

      {/* Card content */}
      {children}
    </div>
  );
}

export default function GoalsPage() {
  const [goals, setGoals] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // reorder state
  const [order, setOrder] = useState([]);

  // modal
  const [editingGoal, setEditingGoal] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [type, setType] = useState("custom");
  const [currentValue, setCurrentValue] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");

  // delete confirm
  const [deleteId, setDeleteId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  /* ------------------------------
     Load user + goals
  ------------------------------- */
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

  /* ------------------------------
     Reorder goals
  ------------------------------- */
  function onDragEnd(e) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = order.indexOf(active.id);
    const newIndex = order.indexOf(over.id);

    const newOrder = arrayMove(order, oldIndex, newIndex);
    setOrder(newOrder);
  }

  /* ------------------------------
     Modal logic
  ------------------------------- */
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

    if (editingGoal) {
      await supabase.from("goals").update(payload).eq("id", editingGoal.id);
    } else {
      await supabase.from("goals").insert(payload);
    }

    closeModal();
    await loadGoals(user.id);
  }

  /* ------------------------------
     Delete with confirm
  ------------------------------- */
  async function confirmDelete() {
    await supabase.from("goals").delete().eq("id", deleteId);
    setDeleteId(null);
    if (user) await loadGoals(user.id);
  }

  /* ------------------------------
     UI
  ------------------------------- */
  if (loading)
    return <p style={{ padding: 20, opacity: 0.7 }}>Loading…</p>;

  return (
    <div
      style={{
        padding: "20px 16px 90px",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
        Goals
      </h1>

      <button
        onClick={() => openModal(null)}
        style={{
          padding: "12px",
          width: "100%",
          background: "#ff2f2f",
          borderRadius: 10,
          border: "none",
          color: "white",
          fontSize: 15,
          fontWeight: 600,
          marginBottom: 18,
        }}
      >
        + Add New Goal
      </button>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={order}
          strategy={verticalListSortingStrategy}
        >
          {order.map((id) => {
            const goal = goals.find((g) => g.id === id);
            if (!goal) return null;

            const current = Number(goal.current_value || 0);
            const target = Number(goal.target_value || 0);

            const progress =
              target > 0
                ? Math.min(100, Math.max(0, Math.round((current / target) * 100)))
                : 0;

            return (
              <SortableItem key={goal.id} id={goal.id}>
                <div
                  style={{
                    background: "#101010",
                    borderRadius: 12,
                    padding: 14,
                    border: "1px solid rgba(255,255,255,0.08)",
                    marginBottom: 12,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* RIGHT SIDE CONTENT — SCROLLABLE */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      width: "100%",
                      pointerEvents: "auto",
                    }}
                  >
                    {/* LEFT (text) */}
                    <div style={{ flex: 1, paddingRight: 10 }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 15,
                          fontWeight: 600,
                        }}
                      >
                        {goal.title}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
                        {current} / {target} {goal.unit}
                      </p>
                    </div>

                    {/* RIGHT BUTTONS */}
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        paddingLeft: 10,
                        pointerEvents: "auto",
                      }}
                    >
                      <FaEdit
                        style={{ cursor: "pointer", fontSize: 14 }}
                        onClick={() => openModal(goal)}
                      />
                      <FaTrash
                        style={{
                          cursor: "pointer",
                          color: "#ff4d4d",
                          fontSize: 14,
                        }}
                        onClick={() => setDeleteId(goal.id)}
                      />
                    </div>
                  </div>

                  {/* PROGRESS BAR + % */}
                  <div style={{ marginTop: 12 }}>
                    <div
                      style={{
                        height: 6,
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
                            "linear-gradient(90deg, #ff2f2f, #ff6b4a)",
                          borderRadius: 999,
                          transition: "width 0.25s ease",
                        }}
                      />
                    </div>

                    <p
                      style={{
                        textAlign: "right",
                        marginTop: 6,
                        fontSize: 13,
                        opacity: 0.85,
                        fontWeight: 600,
                      }}
                    >
                      {progress}%
                    </p>
                  </div>
                </div>
              </SortableItem>
            );
          })}
        </SortableContext>
      </DndContext>

      {/* ---------------- Modal: Add/Edit ---------------- */}
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

      {/* ---------------- Confirm Delete ---------------- */}
      {deleteId && (
        <div style={backdrop} onClick={() => setDeleteId(null)}>
          <div style={card} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, color: "#ff4d4d" }}>
              Confirm Delete?
            </h2>
            <p style={{ opacity: 0.75 }}>This action cannot be undone.</p>

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

/* ---------------- STYLES --------------- */

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
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  padding: 18,
  width: "100%",
  maxWidth: 420,
};

const input = {
  width: "100%",
  padding: 8,
  borderRadius: 8,
  background: "#000",
  border: "1px solid rgba(255,255,255,0.15)",
  color: "white",
  marginBottom: 10,
};

const label = {
  fontSize: 12,
  opacity: 0.85,
  marginBottom: 4,
  display: "block",
};

const saveBtn = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  background: "#ff2f2f",
  color: "white",
  border: "none",
  fontWeight: 600,
  marginBottom: 10,
};

const cancelBtn = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  background: "#333",
  color: "white",
  border: "none",
  marginBottom: 10,
};

const deleteBtn = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  background: "#ff2f2f",
  color: "white",
  border: "none",
  fontWeight: 600,
};


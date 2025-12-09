// src/pages/GoalsPage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

// dnd-kit
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

// Icons
import { FaEdit, FaTrash } from "react-icons/fa";

/* ----------------------------------------------------------
   SORTABLE WRAPPER — LEFT SIDE ONLY IS DRAGGABLE
---------------------------------------------------------- */
function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: "relative",
    touchAction: "none",
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* LEFT DRAG HANDLE (40% width) */}
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
          cursor: "grab",
        }}
      />
      {children}
    </div>
  );
}

/* ----------------------------------------------------------
   MAIN PAGE
---------------------------------------------------------- */
export default function GoalsPage() {
  const [goals, setGoals] = useState([]);
  const [order, setOrder] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modal
  const [editingGoal, setEditingGoal] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Fields
  const [title, setTitle] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");

  // Delete confirm
  const [deleteId, setDeleteId] = useState(null);

  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  /* ----------------------------------------------------------
     LOAD USER + GOALS
  ---------------------------------------------------------- */
  useEffect(() => {
    loadEverything();
  }, []);

  async function loadEverything() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUser(user);
    if (user) await loadGoals(user.id);
    setLoading(false);
  }

  async function loadGoals(uid) {
    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", uid)
      .order("updated_at", { ascending: false });

    if (!error && data) {
      setGoals(data);
      setOrder(data.map((g) => g.id));
    }
  }

  /* ----------------------------------------------------------
     MODAL
  ---------------------------------------------------------- */
  function openModal(goal = null) {
    if (goal) {
      setEditingGoal(goal);
      setTitle(goal.title);
      setCurrentValue(goal.current_value ?? "");
      setTargetValue(goal.target_value ?? "");
      setUnit(goal.unit ?? "");
    } else {
      setEditingGoal(null);
      setTitle("");
      setCurrentValue("");
      setTargetValue("");
      setUnit("");
    }
    setModalOpen(true);
  }

  async function saveGoal() {
    if (!user) return;

    const payload = {
      user_id: user.id,
      title,
      current_value: currentValue ? Number(currentValue) : 0,
      target_value: targetValue ? Number(targetValue) : 0,
      unit,
      updated_at: new Date(),
    };

    if (editingGoal) {
      await supabase.from("goals").update(payload).eq("id", editingGoal.id);
    } else {
      await supabase.from("goals").insert(payload);
    }

    setModalOpen(false);
    await loadGoals(user.id);
  }

  /* ----------------------------------------------------------
     DELETE CONFIRM
  ---------------------------------------------------------- */
  async function confirmDelete() {
    await supabase.from("goals").delete().eq("id", deleteId);
    setDeleteId(null);
    if (user) await loadGoals(user.id);
  }

  /* ----------------------------------------------------------
     DRAG (REORDERING)
  ---------------------------------------------------------- */
  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = order.indexOf(active.id);
    const newIndex = order.indexOf(over.id);

    const newOrder = arrayMove(order, oldIndex, newIndex);
    setOrder(newOrder);

    // Update positions in DB
    newOrder.forEach((id, idx) => {
      supabase.from("goals").update({ position: idx }).eq("id", id);
    });
  }

  /* ----------------------------------------------------------
     UI
  ---------------------------------------------------------- */
  return (
    <div style={{ padding: "20px 16px 90px", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
        Goals
      </h1>

      {/* Add Button */}
      <button
        onClick={() => openModal(null)}
        style={{
          width: "100%",
          padding: 12,
          background: "#ff2f2f",
          color: "white",
          fontWeight: 600,
          borderRadius: 999,
          border: "none",
          marginBottom: 18,
        }}
      >
        + Add New Goal
      </button>

      {loading ? (
        <p style={{ opacity: 0.7 }}>Loading goals...</p>
      ) : goals.length === 0 ? (
        <p style={{ opacity: 0.7 }}>No goals yet.</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            {order.map((id) => {
              const goal = goals.find((g) => g.id === id);
              if (!goal) return null;

              const current = Number(goal.current_value) || 0;
              const target = Number(goal.target_value) || 0;
              const progress = target ? Math.round((current / target) * 100) : 0;

              return (
                <SortableItem key={id} id={id}>
                  <div
                    style={{
                      background: "#0f0f0f",
                      borderRadius: 12,
                      padding: 14,
                      border: "1px solid rgba(255,255,255,0.08)",
                      marginBottom: 12,
                      position: "relative",
                    }}
                  >
                    {/* TITLE + VALUES + ICONS */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <div style={{ flexBasis: "60%" }}>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                          {goal.title}
                        </p>
                        <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
                          {current} / {target} {goal.unit}
                        </p>
                      </div>

                      {/* Right side (scrollable touch) */}
                      <div
                        style={{
                          display: "flex",
                          gap: 12,
                          alignItems: "center",
                          paddingLeft: 12,
                          flexShrink: 0,
                        }}
                      >
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

                    {/* Progress bar with % aligned to bar end */}
                    <div style={{ position: "relative", marginTop: 10 }}>
                      <div
                        style={{
                          width: "100%",
                          height: 6,
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
                        ></div>
                      </div>

                      {/* PERCENT RIGHT AFTER BAR */}
                      <span
                        style={{
                          position: "absolute",
                          left: `calc(${progress}% + 6px)`,
                          top: -18,
                          fontSize: 12,
                          opacity: 0.9,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {progress}%
                      </span>
                    </div>
                  </div>
                </SortableItem>
              );
            })}
          </SortableContext>
        </DndContext>
      )}

      {/* MODAL */}
      {modalOpen && (
        <div style={backdrop} onClick={() => setModalOpen(false)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
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

            <button
              style={primaryBtn}
              onClick={saveGoal}
            >
              Save Goal
            </button>

            <button
              style={secondaryBtn}
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE */}
      {deleteId && (
        <div style={backdrop} onClick={() => setDeleteId(null)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: "#ff4d4d", marginTop: 0 }}>Confirm Delete?</h2>

            <button style={secondaryBtn} onClick={() => setDeleteId(null)}>
              Cancel
            </button>

            <button style={primaryBtn} onClick={confirmDelete}>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------
   SHARED STYLES
---------------------------------------------------------- */
const backdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 20,
  zIndex: 999,
};

const modal = {
  background: "#111",
  padding: 18,
  borderRadius: 12,
  width: "100%",
  maxWidth: 420,
  border: "1px solid rgba(255,255,255,0.12)",
};

const input = {
  width: "100%",
  padding: 8,
  marginBottom: 12,
  borderRadius: 8,
  background: "#000",
  border: "1px solid rgba(255,255,255,0.2)",
  color: "white",
};

const label = {
  fontSize: 12,
  opacity: 0.85,
  marginBottom: 4,
  display: "block",
};

const primaryBtn = {
  width: "100%",
  padding: 10,
  marginTop: 10,
  background: "#ff2f2f",
  border: "none",
  color: "white",
  borderRadius: 10,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryBtn = {
  width: "100%",
  padding: 10,
  marginTop: 10,
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.25)",
  color: "white",
  borderRadius: 10,
  fontWeight: 600,
  cursor: "pointer",
};

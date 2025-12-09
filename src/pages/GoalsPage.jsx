// src/pages/GoalsPage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

// dnd-kit (same as Measurements + PR pages)
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

/* -------------------------
   SORTABLE ITEM (LEFT ONLY)
-------------------------- */
function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: "none",
      }}
    >
      {children({ attributes, listeners })}
    </div>
  );
}

/* -------------------------
   MAIN PAGE
-------------------------- */
export default function GoalsPage() {
  const [goals, setGoals] = useState([]);
  const [order, setOrder] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("custom");
  const [currentValue, setCurrentValue] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");

  // Confirm delete
  const [deleteId, setDeleteId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  /* -------------------------
     LOAD USER + GOALS
  -------------------------- */
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data } = await supabase
          .from("goals")
          .select("*")
          .eq("user_id", user.id)
          .order("order_index", { ascending: true }); // optional field

        setGoals(data || []);
        setOrder((data || []).map((g) => g.id));
      }

      setLoading(false);
    })();
  }, []);

  /* -------------------------
      DRAG END
  -------------------------- */
  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || over.id === active.id) return;

    const oldIdx = order.indexOf(active.id);
    const newIdx = order.indexOf(over.id);

    const newOrder = arrayMove(order, oldIdx, newIdx);
    setOrder(newOrder);

    // Save order to DB
    newOrder.forEach(async (id, i) => {
      await supabase.from("goals").update({ order_index: i }).eq("id", id);
    });
  }

  /* -------------------------
      OPEN MODAL
  -------------------------- */
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

  /* -------------------------
      SAVE GOAL
  -------------------------- */
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
      const { data, error } = await supabase
        .from("goals")
        .insert({ ...payload, order_index: order.length })
        .select();

      if (!error && data?.length) {
        setOrder((prev) => [...prev, data[0].id]);
      }
    }

    closeModal();

    const { data } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .order("order_index", { ascending: true });

    setGoals(data || []);
  }

  /* -------------------------
      DELETE GOAL
  -------------------------- */
  async function confirmDelete() {
    await supabase.from("goals").delete().eq("id", deleteId);

    const { data } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .order("order_index", { ascending: true });

    setGoals(data || []);
    setOrder((data || []).map((g) => g.id));
    setDeleteId(null);
  }

  if (loading)
    return <p style={{ padding: 20, opacity: 0.7 }}>Loading…</p>;

  /* -------------------------
      PAGE
  -------------------------- */
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
          width: "100%",
          padding: 12,
          background: "#ff2f2f",
          borderRadius: 10,
          border: "none",
          color: "white",
          fontSize: 15,
          fontWeight: 600,
          marginBottom: 18,
          cursor: "pointer",
          boxShadow: "0 0 14px rgba(255,47,47,0.35)",
        }}
      >
        + Add New Goal
      </button>

      {/* DRAGGABLE LIST */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          {order.map((id) => {
            const goal = goals.find((g) => g.id === id);
            if (!goal) return null;

            const current = goal.current_value ?? 0;
            const target = goal.target_value ?? 0;
            const pct =
              target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

            return (
              <SortableItem key={goal.id} id={goal.id}>
                {({ attributes, listeners }) => (
                  <div
                    style={{
                      background: "#0f0f0f",
                      borderRadius: 12,
                      padding: 14,
                      border: "1px solid rgba(255,255,255,0.08)",
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      {/* LEFT = DRAG HANDLE AREA (50%) */}
                      <div
                        style={{
                          flexBasis: "50%",
                          cursor: "grab",
                          userSelect: "none",
                        }}
                        {...attributes}
                        {...listeners}
                      >
                        <p
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            margin: 0,
                          }}
                        >
                          {goal.title}
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 12,
                            opacity: 0.7,
                          }}
                        >
                          {current} / {target} {goal.unit}
                        </p>
                      </div>

                      {/* RIGHT = ICONS + SCROLLABLE CLICK AREA */}
                      <div
                        style={{
                          flex: 1,
                          textAlign: "right",
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: 12,
                        }}
                      >
                        <FaEdit
                          style={{ cursor: "pointer", opacity: 0.9 }}
                          onClick={() => openModal(goal)}
                        />
                        <FaTrash
                          style={{ cursor: "pointer", color: "#ff4d4d" }}
                          onClick={() => setDeleteId(goal.id)}
                        />
                      </div>
                    </div>

                    {/* PROGRESS BAR + % */}
                    <div style={{ marginTop: 10 }}>
                      <div
                        style={{
                          height: 6,
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.06)",
                          overflow: "hidden",
                          marginBottom: 4,
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            background:
                              "linear-gradient(90deg,#ff2f2f,#ff6b4a)",
                          }}
                        />
                      </div>

                      <p
                        style={{
                          textAlign: "right",
                          fontSize: 12,
                          opacity: 0.75,
                          margin: 0,
                        }}
                      >
                        {pct}% complete
                      </p>
                    </div>
                  </div>
                )}
              </SortableItem>
            );
          })}
        </SortableContext>
      </DndContext>

      {/* MODAL */}
      {modalOpen && (
        <div style={modalBackdrop} onClick={closeModal}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>
              {editingGoal ? "Edit Goal" : "Create Goal"}
            </h2>

            <label style={labelStyle}>Title</label>
            <input
              style={inputStyle}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <label style={labelStyle}>Type</label>
            <select
              style={inputStyle}
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="custom">Custom</option>
              <option value="pr">PR</option>
              <option value="measurement">Measurement</option>
            </select>

            <label style={labelStyle}>Current Value</label>
            <input
              type="number"
              style={inputStyle}
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
            />

            <label style={labelStyle}>Target Value</label>
            <input
              type="number"
              style={inputStyle}
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
            />

            <label style={labelStyle}>Unit</label>
            <input
              style={inputStyle}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />

            <button
              style={{
                width: "100%",
                padding: 10,
                background: "#ff2f2f",
                border: "none",
                borderRadius: 10,
                color: "white",
                fontWeight: 600,
                fontSize: 15,
                marginTop: 8,
              }}
              onClick={saveGoal}
            >
              Save Goal
            </button>

            <button
              style={{
                width: "100%",
                padding: 10,
                background: "#222",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 10,
                marginTop: 10,
                color: "white",
              }}
              onClick={closeModal}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteId && (
        <div style={modalBackdrop} onClick={() => setDeleteId(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, color: "#ff4d4d" }}>
              Confirm Delete?
            </h2>

            <p style={{ opacity: 0.8 }}>This cannot be undone.</p>

            <button
              style={{
                width: "100%",
                padding: 10,
                background: "#333",
                borderRadius: 10,
                border: "none",
                color: "white",
                marginBottom: 10,
              }}
              onClick={() => setDeleteId(null)}
            >
              Cancel
            </button>

            <button
              style={{
                width: "100%",
                padding: 10,
                background: "#ff2f2f",
                borderRadius: 10,
                border: "none",
                color: "white",
                fontWeight: 600,
              }}
              onClick={confirmDelete}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------
     STYLES
-------------------------- */
const modalBackdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.65)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 20,
  zIndex: 999,
};

const modalCard = {
  background: "#111",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  padding: 18,
  width: "100%",
  maxWidth: 420,
};

const inputStyle = {
  width: "100%",
  padding: 8,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "#000",
  color: "white",
  marginBottom: 10,
};

const labelStyle = {
  fontSize: 12,
  opacity: 0.85,
  marginBottom: 4,
};

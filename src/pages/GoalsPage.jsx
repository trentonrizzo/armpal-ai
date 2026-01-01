// src/pages/GoalsPage.jsx
// ============================================================
// ARM PAL — GOALS PAGE (OPTIONAL TARGET DATE SUPPORT)
// FULL FILE REPLACEMENT — SAFE, RED THEME, NO FORCED DATES
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
   SORTABLE WRAPPER (LEFT HANDLE 40%)
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
  const [type, setType] = useState("custom");
  const [currentValue, setCurrentValue] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");

  // OPTIONAL target date
  const [useTargetDate, setUseTargetDate] = useState(false);
  const [targetDate, setTargetDate] = useState(""); // YYYY-MM-DD

  // state
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
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
      const { data } = await supabase.auth.getUser();
      const u = data?.user || null;
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
     REORDER
  ============================================================ */
  function onDragEnd(e) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = order.indexOf(active.id);
    const newIndex = order.indexOf(over.id);
    setOrder(arrayMove(order, oldIndex, newIndex));
  }

  /* ============================================================
     MODAL
  ============================================================ */
  function openModal(goal = null) {
    setFormError("");

    if (goal) {
      setEditingGoal(goal);
      setTitle(goal.title || "");
      setType(goal.type || "custom");
      setCurrentValue(goal.current_value ?? "");
      setTargetValue(goal.target_value ?? "");
      setUnit(goal.unit || "");

      if (goal.target_date) {
        setUseTargetDate(true);
        setTargetDate(goal.target_date.slice(0, 10));
      } else {
        setUseTargetDate(false);
        setTargetDate("");
      }
    } else {
      setEditingGoal(null);
      setTitle("");
      setType("custom");
      setCurrentValue("");
      setTargetValue("");
      setUnit("");
      setUseTargetDate(false);
      setTargetDate("");
    }

    setModalOpen(true);
  }

  function closeModal() {
    if (!saving) setModalOpen(false);
  }

  /* ============================================================
     SAVE GOAL (TARGET DATE IS 100% OPTIONAL)
  ============================================================ */
  async function saveGoal() {
    if (!user) return;
    setFormError("");

    const finalTitle = title.trim() || (type === "bodyweight" ? "Bodyweight" : "");
    if (!finalTitle) return setFormError("Title required.");

    const tgt = Number(targetValue);
    if (Number.isNaN(tgt)) return setFormError("Target must be a number.");

    const payload = {
      user_id: user.id,
      title: finalTitle,
      type,
      current_value: currentValue ? Number(currentValue) : null,
      target_value: tgt,
      unit: type === "bodyweight" ? "lb" : unit,
      target_date: useTargetDate && targetDate ? new Date(targetDate).toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    setSaving(true);

    if (editingGoal) {
      await supabase.from("goals").update(payload).eq("id", editingGoal.id);
    } else {
      await supabase.from("goals").insert(payload);
    }

    setSaving(false);
    setModalOpen(false);
    await loadGoals(user.id);
  }

  /* ============================================================
     DELETE
  ============================================================ */
  async function confirmDelete() {
    setDeleting(true);
    await supabase.from("goals").delete().eq("id", deleteId);
    setDeleting(false);
    setDeleteId(null);
    await loadGoals(user.id);
  }

  const orderedGoals = useMemo(() => order.map((id) => goals.find((g) => g.id === id)).filter(Boolean), [order, goals]);

  if (loading) return <p style={{ padding: 20 }}>Loading…</p>;

  return (
    <div style={{ padding: "20px 16px 90px", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 900 }}>Goals</h1>

      <button onClick={() => openModal(null)} style={addBtn}>
        + Add New Goal
      </button>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          {orderedGoals.map((goal) => (
            <SortableItem key={goal.id} id={goal.id}>
              <div style={goalCard}>
                <div style={{ fontWeight: 800 }}>{goal.title}</div>
                <div style={{ opacity: 0.75, fontSize: 13 }}>
                  {goal.current_value ?? "—"} / {goal.target_value} {goal.unit}
                </div>
              </div>
            </SortableItem>
          ))}
        </SortableContext>
      </DndContext>

      {/* MODAL */}
      {modalOpen && (
        <div style={backdrop} onClick={closeModal}>
          <div style={card} onClick={(e) => e.stopPropagation()}>
            <h2>{editingGoal ? "Edit Goal" : "New Goal"}</h2>

            {formError && <div style={errorBox}>{formError}</div>}

            <label style={label}>Title</label>
            <input style={input} value={title} onChange={(e) => setTitle(e.target.value)} />

            <label style={label}>Goal Type</label>
            <select style={input} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="custom">Custom</option>
              <option value="bodyweight">Bodyweight</option>
              <option value="strength">Strength</option>
            </select>

            <label style={label}>Current Value</label>
            <input style={input} type="number" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />

            <label style={label}>Target Value</label>
            <input style={input} type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />

            <div style={{ margin: "10px 0" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={useTargetDate} onChange={(e) => setUseTargetDate(e.target.checked)} />
                Set target date (optional)
              </label>
            </div>

            {useTargetDate && (
              <input style={input} type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            )}

            <button style={saveBtn} onClick={saveGoal} disabled={saving}>
              {saving ? "Saving…" : "Save Goal"}
            </button>
            <button style={cancelBtn} onClick={closeModal}>Cancel</button>
          </div>
        </div>
      )}

      {deleteId && (
        <div style={backdrop}>
          <div style={card}>
            <h2>Delete goal?</h2>
            <button style={cancelBtn} onClick={() => setDeleteId(null)}>Cancel</button>
            <button style={deleteBtn} onClick={confirmDelete} disabled={deleting}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   STYLES
============================================================ */
const addBtn = { width: "100%", padding: 14, borderRadius: 14, background: "#ff2f2f", color: "#fff", border: "none", fontWeight: 900, marginBottom: 18 };
const goalCard = { background: "#101010", borderRadius: 14, padding: 16, border: "1px solid rgba(255,255,255,0.08)", marginBottom: 14 };
const backdrop = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 };
const card = { background: "#111", padding: 18, borderRadius: 16, width: "100%", maxWidth: 440 };
const input = { width: "100%", padding: 12, borderRadius: 12, background: "#000", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", marginBottom: 12 };
const label = { fontSize: 12, fontWeight: 700, marginBottom: 6, display: "block" };
const saveBtn = { width: "100%", padding: 12, borderRadius: 14, background: "#ff2f2f", color: "#fff", border: "none", fontWeight: 900, marginBottom: 10 };
const cancelBtn = { width: "100%", padding: 12, borderRadius: 14, background: "#333", color: "#fff", border: "none", marginBottom: 10 };
const deleteBtn = { width: "100%", padding: 12, borderRadius: 14, background: "#ff2f2f", color: "#fff", border: "none", fontWeight: 900 };
const errorBox = { background: "rgba(255,47,47,0.15)", padding: 10, borderRadius: 12, fontWeight: 700, marginBottom: 12 };

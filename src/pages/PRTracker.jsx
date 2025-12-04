// src/pages/PRTracker.jsx
import React, { useContext, useState, useMemo, useEffect } from "react";
import { AppContext } from "../context/AppContext";
import { FaTrashAlt, FaEdit } from "react-icons/fa";

/* ============================================================
   ARMPAL NEON GLOW CARD (B-STYLE: Medium Strength Neon Pulse)
   ============================================================ */
function GlowCard({ children, dragging }) {
  return (
    <div
      className={`
        relative rounded-2xl p-4 mb-4
        bg-[#080808]
        border border-[rgba(255,0,0,0.16)]
        transition-all duration-200
        ${dragging ? "scale-[0.96] opacity-[0.82]" : "scale-100"}
      `}
      style={{
        background:
          "radial-gradient(circle at top left, rgba(255,0,0,0.18), rgba(0,0,0,0.85))",
        boxShadow: `
          0 0 22px rgba(255, 35, 35, 0.55),
          inset 0 0 16px rgba(255, 0, 0, 0.25)
        `,
        animation: "pulseGlow 3.4s ease-in-out infinite",
      }}
    >
      {children}
    </div>
  );
}

// Neon pulse style injection (only once)
const style = document.createElement("style");
style.innerHTML = `
@keyframes pulseGlow {
  0% { box-shadow: 0 0 10px rgba(255,45,45,0.35), inset 0 0 14px rgba(255,0,0,0.25); }
  50% { box-shadow: 0 0 26px rgba(255,45,45,0.9), inset 0 0 18px rgba(255,0,0,0.32); }
  100% { box-shadow: 0 0 10px rgba(255,45,45,0.35), inset 0 0 14px rgba(255,0,0,0.25); }
}`;
document.head.appendChild(style);

export default function PRTracker() {
  const {
    prs,
    createPR,
    editPR,
    removePR,
    reorderPRs,
  } = useContext(AppContext);

  // NEW PR
  const [newLift, setNewLift] = useState("");
  const [newWeight, setNewWeight] = useState("");
  const [newReps, setNewReps] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newUnit, setNewUnit] = useState("lbs");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);

  // EDITING
  const [editingId, setEditingId] = useState(null);
  const [editLift, setEditLift] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editUnit, setEditUnit] = useState("lbs");
  const [editDate, setEditDate] = useState("");

  // DELETING
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // DRAGGING
  const [draggingId, setDraggingId] = useState(null);
  let pressTimer = null;

  const flatPRs = useMemo(() => {
    return [...prs].sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
    );
  }, [prs]);

  // ADD
  async function handleAddPR() {
    if (!newLift || !newWeight) return;

    await createPR(
      newLift.trim(),
      Number(newWeight),
      newUnit,
      newDate,
      newReps ? Number(newReps) : null,
      newNotes || null
    );

    setNewLift("");
    setNewWeight("");
    setNewReps("");
    setNewNotes("");
    setNewUnit("lbs");
    setNewDate(new Date().toISOString().split("T")[0]);
  }

  // START EDIT
  function beginEdit(pr) {
    setEditingId(pr.id);
    setEditLift(pr.lift_name);
    setEditWeight(pr.weight);
    setEditReps(pr.reps ?? "");
    setEditNotes(pr.notes || "");
    setEditUnit(pr.unit);
    setEditDate(pr.date);
  }

  // SAVE EDIT
  async function saveEdit() {
    await editPR(editingId, {
      lift_name: editLift.trim(),
      weight: Number(editWeight),
      unit: editUnit,
      reps: editReps ? Number(editReps) : null,
      notes: editNotes || null,
      date: editDate,
    });

    setEditingId(null);
  }

  // DRAGGING
  function handleTouchStart(id) {
    pressTimer = setTimeout(() => {
      setDraggingId(id);
    }, 220);
  }
  function handleTouchEnd() {
    clearTimeout(pressTimer);
  }
  function handleDragOver(e) {
    e.preventDefault();
  }
  async function handleDrop(targetId) {
    if (draggingId === targetId) return setDraggingId(null);

    const list = [...flatPRs];
    const from = list.findIndex((p) => p.id === draggingId);
    const to = list.findIndex((p) => p.id === targetId);

    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);

    await reorderPRs(
      list.map((p, i) => ({ id: p.id, order_index: i }))
    );

    setDraggingId(null);
  }

  // RENDER PR CARD
  function PRCard(pr) {
    const editing = editingId === pr.id;
    const deleting = confirmDeleteId === pr.id;

    return (
      <div
        key={pr.id}
        draggable
        onDragOver={handleDragOver}
        onDrop={() => handleDrop(pr.id)}
        onTouchStart={() => handleTouchStart(pr.id)}
        onTouchEnd={handleTouchEnd}
      >
        <GlowCard dragging={draggingId === pr.id}>
          {editing ? (
            /* EDIT MODE */
            <div className="space-y-3">
              <input
                className="neon-input"
                value={editLift}
                onChange={(e) => setEditLift(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  className="neon-input"
                  value={editWeight}
                  onChange={(e) => setEditWeight(e.target.value)}
                />
                <input
                  type="number"
                  className="neon-input"
                  value={editReps}
                  onChange={(e) => setEditReps(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <select
                  className="neon-input"
                  value={editUnit}
                  onChange={(e) => setEditUnit(e.target.value)}
                >
                  <option value="lbs">lbs</option>
                  <option value="kg">kg</option>
                </select>

                <input
                  type="date"
                  className="neon-input"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>

              <textarea
                className="neon-input"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />

              <div className="flex justify-end gap-3">
                <button
                  className="px-4 py-2 bg-neutral-700 rounded-lg text-xs"
                  onClick={() => setEditingId(null)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-red-600 rounded-lg text-xs"
                  onClick={saveEdit}
                >
                  Save
                </button>
              </div>
            </div>
          ) : deleting ? (
            /* DELETE CONFIRM */
            <div className="text-center space-y-4">
              <p className="text-sm">Delete this PR?</p>
              <div className="flex justify-center gap-4">
                <button
                  className="px-4 py-2 bg-neutral-700 rounded-lg text-xs"
                  onClick={() => setConfirmDeleteId(null)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-red-600 rounded-lg text-xs"
                  onClick={async () => {
                    await removePR(pr.id);
                    setConfirmDeleteId(null);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            /* NORMAL CARD VIEW */
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <p className="font-semibold text-[15px] leading-tight">
                  {pr.lift_name}
                </p>

                <div className="flex gap-4">
                  <button onClick={() => beginEdit(pr)}>
                    <FaEdit size={15} className="text-red-400" />
                  </button>
                  <button onClick={() => setConfirmDeleteId(pr.id)}>
                    <FaTrashAlt size={15} className="text-red-500" />
                  </button>
                </div>
              </div>

              <p className="text-neutral-400 text-xs">
                {pr.weight} {pr.unit}
                {pr.reps ? ` • ${pr.reps} reps` : ""} • {pr.date}
              </p>

              {pr.notes && (
                <p className="text-neutral-500 text-xs italic">
                  Notes: {pr.notes}
                </p>
              )}
            </div>
          )}
        </GlowCard>
      </div>
    );
  }

  return (
    <div className="p-5 pb-24 min-h-screen bg-black text-white">
      <h1 className="text-3xl font-bold text-red-500 mb-4">
        Personal Records
      </h1>

      {/* ADD NEW PR */}
      <GlowCard>
        <h2 className="text-lg font-semibold text-red-400 mb-4">Add New PR</h2>

        <input
          className="neon-input mb-3"
          placeholder="Lift name"
          value={newLift}
          onChange={(e) => setNewLift(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3 mb-3">
          <input
            type="number"
            className="neon-input"
            placeholder="Weight"
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
          />
          <input
            type="number"
            className="neon-input"
            placeholder="Reps"
            value={newReps}
            onChange={(e) => setNewReps(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <select
            className="neon-input"
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
          >
            <option value="lbs">lbs</option>
            <option value="kg">kg</option>
          </select>

          <input
            type="date"
            className="neon-input"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
        </div>

        <textarea
          className="neon-input mb-3"
          placeholder="Notes (optional)"
          value={newNotes}
          onChange={(e) => setNewNotes(e.target.value)}
        />

        <button
          onClick={handleAddPR}
          className="w-full py-2 bg-red-600 rounded-lg font-bold text-sm"
        >
          Save PR
        </button>
      </GlowCard>

      {/* PR LIST */}
      <div className="mt-6">
        {flatPRs.map((p) => PRCard(p))}
      </div>
    </div>
  );
}

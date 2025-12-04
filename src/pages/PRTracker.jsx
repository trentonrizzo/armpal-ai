// src/pages/PRTracker.jsx
import React, { useContext, useState, useMemo } from "react";
import { AppContext } from "../context/AppContext";
import { FaTrashAlt, FaEdit } from "react-icons/fa";

// ====================================================================
//  CLEAN ORMPAL GLOW CARD — FIXED (NO STRIPES, ICONS ALWAYS ON RIGHT)
// ====================================================================
function GlowCard({ children, dragging }) {
  return (
    <div
      className={`
        relative mb-4 rounded-2xl p-4
        bg-[#0a0a0a]
        border border-[#1d1d1d]
        transition-all duration-200
        ${dragging ? "scale-[0.97] opacity-80" : "scale-100"}
      `}
      style={{
        boxShadow: dragging
          ? "0 0 12px rgba(255,0,0,0.45)"
          : "0 0 8px rgba(255,0,0,0.22)",
      }}
    >
      <div className="rounded-xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}

export default function PRTracker() {
  const { prs, createPR, editPR, removePR, reorderPRs } =
    useContext(AppContext);

  // NEW PR STATE
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

  // DELETE CONFIRM
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // DRAGGING
  const [draggingId, setDraggingId] = useState(null);

  // SORTED PR LIST
  const flatPRs = useMemo(
    () => [...prs].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
    [prs]
  );

  // CREATE PR
  async function handleAddPR() {
    if (!newLift.trim() || !newWeight.trim()) {
      alert("Lift & weight required.");
      return;
    }

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

  // BEGIN EDIT
  function beginEdit(pr) {
    setEditingId(pr.id);
    setEditLift(pr.lift_name);
    setEditWeight(pr.weight);
    setEditReps(pr.reps ?? "");
    setEditNotes(pr.notes || "");
    setEditUnit(pr.unit || "lbs");
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
  function handleDragStart(id) {
    setDraggingId(id);
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  async function handleDrop(targetId) {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      return;
    }

    const list = [...flatPRs];
    const from = list.findIndex((p) => p.id === draggingId);
    const to = list.findIndex((p) => p.id === targetId);

    if (from === -1 || to === -1) return setDraggingId(null);

    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);

    await reorderPRs(list.map((p, i) => ({ id: p.id, order_index: i })));

    setDraggingId(null);
  }

  // ====================================================================
  // PR CARD (WITH ICONS LOCKED RIGHT SIDE)
  // ====================================================================
  function PRCard(pr) {
    const isEditing = editingId === pr.id;
    const isDeleting = confirmDeleteId === pr.id;
    const isDragging = draggingId === pr.id;

    return (
      <div
        key={pr.id}
        draggable
        onDragStart={() => handleDragStart(pr.id)}
        onDragOver={handleDragOver}
        onDrop={() => handleDrop(pr.id)}
      >
        <GlowCard dragging={isDragging}>
          {isEditing ? (
            // ======================= EDIT MODE =======================
            <div className="space-y-3">
              <input
                className="w-full p-2 rounded-lg bg-black border border-neutral-700 text-sm"
                value={editLift}
                onChange={(e) => setEditLift(e.target.value)}
              />

              {/* Weight + Reps */}
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  className="p-2 rounded-lg bg-black border border-neutral-700 text-sm"
                  value={editWeight}
                  onChange={(e) => setEditWeight(e.target.value)}
                />
                <input
                  type="number"
                  className="p-2 rounded-lg bg-black border border-neutral-700 text-sm"
                  value={editReps}
                  onChange={(e) => setEditReps(e.target.value)}
                />
              </div>

              {/* Unit + Date */}
              <div className="grid grid-cols-2 gap-3">
                <select
                  className="p-2 rounded-lg bg-black border border-neutral-700 text-sm"
                  value={editUnit}
                  onChange={(e) => setEditUnit(e.target.value)}
                >
                  <option value="lbs">lbs</option>
                  <option value="kg">kg</option>
                </select>

                <input
                  type="date"
                  className="p-2 rounded-lg bg-black border border-neutral-700 text-sm"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>

              <textarea
                className="w-full p-2 rounded-lg bg-black border border-neutral-700 text-sm"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Notes"
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
          ) : isDeleting ? (
            // ================== DELETE CONFIRM ==================
            <div className="text-center space-y-3">
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
            // ======================= NORMAL VIEW =======================
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <p className="font-semibold text-[15px] leading-tight">
                  {pr.lift_name}
                </p>

                {/* ICONS ALWAYS ON RIGHT */}
                <div className="flex gap-3">
                  <button onClick={() => beginEdit(pr)}>
                    <FaEdit className="text-red-400 active:scale-90" size={15} />
                  </button>
                  <button onClick={() => setConfirmDeleteId(pr.id)}>
                    <FaTrashAlt className="text-red-500 active:scale-90" size={15} />
                  </button>
                </div>
              </div>

              {/* DETAILS */}
              <p className="text-neutral-400 text-xs">
                {pr.weight} {pr.unit} •{" "}
                {pr.reps ? `${pr.reps} reps • ` : ""}
                {pr.date}
              </p>

              {/* NOTES */}
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

  // ====================================================================
  // MAIN RENDER
  // ====================================================================
  return (
    <div className="p-5 pb-24 min-h-screen bg-black text-white">
      <h1 className="text-3xl font-bold text-red-500 mb-4">
        Personal Records
      </h1>

      {/* ADD PR CARD */}
      <GlowCard>
        <h2 className="text-lg font-semibold text-red-400 mb-4">
          Add New PR
        </h2>

        <input
          className="w-full p-2 rounded-lg bg-black border border-neutral-700 text-sm mb-3"
          placeholder="Lift name"
          value={newLift}
          onChange={(e) => setNewLift(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3 mb-3">
          <input
            type="number"
            className="p-2 rounded-lg bg-black border border-neutral-700 text-sm"
            placeholder="Weight"
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
          />
          <input
            type="number"
            className="p-2 rounded-lg bg-black border border-neutral-700 text-sm"
            placeholder="Reps"
            value={newReps}
            onChange={(e) => setNewReps(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <select
            className="p-2 rounded-lg bg-black border border-neutral-700 text-sm"
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
          >
            <option value="lbs">lbs</option>
            <option value="kg">kg</option>
          </select>

          <input
            type="date"
            className="p-2 rounded-lg bg-black border border-neutral-700 text-sm"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
        </div>

        <textarea
          className="w-full p-2 rounded-lg bg-black border border-neutral-700 text-sm mb-3"
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

      {/* ACTUAL PR CARDS */}
      <div className="mt-6">
        {flatPRs.map((pr) => PRCard(pr))}
      </div>
    </div>
  );
}

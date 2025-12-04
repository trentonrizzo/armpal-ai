import React, { useContext, useState, useMemo } from "react";
import { AppContext } from "../context/AppContext";
import { FaTrashAlt, FaEdit } from "react-icons/fa";

// Glow card
function GlowCard({ children, dragging }) {
  return (
    <div
      className={`
        w-full
        relative mb-4 rounded-xl p-4
        bg-[#0b0b0b]
        border border-[#1b1b1b]
        transition-all duration-200
        ${dragging ? "scale-[0.97] opacity-80" : "scale-100"}
      `}
      style={{
        boxShadow: `
          0 0 12px rgba(255,0,0,0.25),
          0 0 22px rgba(255,0,0,0.15)
        `,
      }}
    >
      {children}
    </div>
  );
}

export default function PRTracker() {
  const { prs, createPR, editPR, removePR, reorderPRs } =
    useContext(AppContext);

  const [newLift, setNewLift] = useState("");
  const [newWeight, setNewWeight] = useState("");
  const [newReps, setNewReps] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newUnit, setNewUnit] = useState("lbs");
  const [newDate, setNewDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [editingId, setEditingId] = useState(null);
  const [editLift, setEditLift] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editUnit, setEditUnit] = useState("lbs");
  const [editDate, setEditDate] = useState("");

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);

  const flatPRs = useMemo(
    () =>
      [...prs].sort(
        (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
      ),
    [prs]
  );

  async function handleAddPR() {
    if (!newLift.trim() || !newWeight.trim()) {
      alert("Lift name and weight required.");
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

  function beginEdit(pr) {
    setEditingId(pr.id);
    setEditLift(pr.lift_name || "");
    setEditWeight(pr.weight ?? "");
    setEditReps(pr.reps ?? "");
    setEditNotes(pr.notes || "");
    setEditUnit(pr.unit || "lbs");
    setEditDate(pr.date || new Date().toISOString().split("T")[0]);
  }

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
    const fromIndex = list.findIndex((p) => p.id === draggingId);
    const toIndex = list.findIndex((p) => p.id === targetId);

    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);

    const updates = list.map((p, i) => ({
      id: p.id,
      order_index: i,
    }));

    await reorderPRs(updates);
    setDraggingId(null);
  }

  function PRCard(pr) {
    const editing = editingId === pr.id;
    const deleting = confirmDeleteId === pr.id;
    const isDragging = draggingId === pr.id;

    return (
      <div
        key={pr.id}
        draggable
        onDragStart={() => handleDragStart(pr.id)}
        onDragOver={handleDragOver}
        onDrop={() => handleDrop(pr.id)}
        className="w-full"
      >
        <GlowCard dragging={isDragging}>
          {editing ? (
            <div className="space-y-3">
              {/* EDIT MODE CONTENT */}
              <input
                className="w-full p-2 rounded-lg bg-black border border-neutral-700 text-sm"
                value={editLift}
                onChange={(e) => setEditLift(e.target.value)}
              />

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
            // NORMAL VIEW
            <div className="space-y-2">

              {/* 🔥 FIXED — PERMANENT RIGHT-SIDE ICONS */}
              <div className="flex items-start justify-between w-full min-w-0">

                <p className="font-semibold text-[15px] truncate">
                  {pr.lift_name}
                </p>

                {/* 🔥 ICONS NEVER COLLAPSE, ALWAYS RIGHT */}
                <div className="flex-shrink-0 flex gap-4">
                  <button onClick={() => beginEdit(pr)}>
                    <FaEdit size={16} className="text-red-400" />
                  </button>
                  <button onClick={() => setConfirmDeleteId(pr.id)}>
                    <FaTrashAlt size={16} className="text-red-500" />
                  </button>
                </div>

              </div>

              <p className="text-neutral-400 text-xs">
                {pr.weight} {pr.unit} •{" "}
                {pr.reps ? `${pr.reps} reps • ` : ""}
                {pr.date}
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
    <div className="p-5 pb-24 min-h-screen bg-black text-white flex flex-col items-center">
      <div className="w-full max-w-xl">
        <h1 className="text-3xl font-bold text-red-500 mb-4">
          Personal Records
        </h1>

        {/* ADD FORM */}
        <GlowCard>
          <h2 className="text-lg font-semibold text-red-400 mb-4">
            Add New PR
          </h2>

          <input
            className="w-full p-2 rounded-lg bg-black border border-neutral-700 text-sm mb-3"
            placeholder="Lift name (Bench, Curl, Squat...)"
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

        {/* LIST */}
        <div className="mt-6 w-full">
          {flatPRs.map((p) => PRCard(p))}
        </div>
      </div>
    </div>
  );
}

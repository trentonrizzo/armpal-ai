// =============================================
//  PRTracker.jsx — ArmPal Premium PR System
//  PART 1 / 2  (paste PART 2 below this)
// =============================================
import React, { useContext, useState, useMemo } from "react";
import { AppContext } from "../context/AppContext";
import { FaTrashAlt, FaEdit } from "react-icons/fa";

// ============================
// GLOW CARD (B - medium glow)
// ============================
function GlowCard({ children, isDragging }) {
  return (
    <div
      className={`relative rounded-2xl p-4 mb-4 transition-all duration-200 
        bg-[#0a0a0a] border border-[#1a1a1a]
        ${isDragging ? "scale-[0.97] opacity-[0.85]" : "scale-100"}
      `}
      style={{
        boxShadow:
          "0 0 14px rgba(255,0,0,0.32), inset 0 0 8px rgba(255,0,0,0.18)",
      }}
    >
      {children}
    </div>
  );
}

export default function PRTracker() {
  const {
    prs,
    createPR,
    editPR,
    removePR,
    reorderPRs,
    groups,
  } = useContext(AppContext);

  // Add PR state
  const [newLift, setNewLift] = useState("");
  const [newWeight, setNewWeight] = useState("");
  const [newReps, setNewReps] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newUnit, setNewUnit] = useState("lbs");
  const [newDate, setNewDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editLift, setEditLift] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editUnit, setEditUnit] = useState("lbs");
  const [editDate, setEditDate] = useState("");

  // Delete confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Drag-reorder state
  const [draggingId, setDraggingId] = useState(null);

  // ============================
  // SORT PRs by order_index
  // ============================
  const flatPRs = useMemo(() => {
    return [...prs].sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
    );
  }, [prs]);

  // ============================
  // Add a PR
  // ============================
  async function handleAddPR() {
    if (!newLift.trim() || !newWeight.trim()) {
      alert("Lift name & weight required");
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

  // ============================
  // Start Editing PR
  // ============================
  function startEdit(pr) {
    setEditingId(pr.id);
    setEditLift(pr.lift_name);
    setEditWeight(pr.weight);
    setEditReps(pr.reps ?? "");
    setEditNotes(pr.notes || "");
    setEditUnit(pr.unit || "lbs");
    setEditDate(
      pr.date || new Date().toISOString().split("T")[0]
    );
  }

  // ============================
  // Save Edit
  // ============================
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

  // ============================
  // Drag & Drop logic
  // ============================
  function handleDragStart(id) {
    setDraggingId(id);
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  async function handleDrop(targetId) {
    if (draggingId === targetId) {
      setDraggingId(null);
      return;
    }

    const list = [...flatPRs];
    const from = list.findIndex((p) => p.id === draggingId);
    const to = list.findIndex((p) => p.id === targetId);

    if (from === -1 || to === -1) {
      setDraggingId(null);
      return;
    }

    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);

    const updates = list.map((p, i) => ({
      id: p.id,
      order_index: i,
    }));

    await reorderPRs(updates);
    setDraggingId(null);
  }

  // ============================
  // PR Card Component
  // ============================
  function PRCard(pr) {
    const isEditing = editingId === pr.id;
    const isConfirmDelete = confirmDeleteId === pr.id;

    return (
      <div
        key={pr.id}
        draggable
        onDragStart={() => handleDragStart(pr.id)}
        onDragOver={handleDragOver}
        onDrop={() => handleDrop(pr.id)}
      >
        <GlowCard isDragging={draggingId === pr.id}>
          {/* ============= EDIT MODE ============= */}
          {isEditing ? (
            <div className="space-y-3">
              <input
                className="w-full p-2 rounded-lg bg-black border border-neutral-700 text-sm"
                value={editLift}
                onChange={(e) => setEditLift(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  className="p-2 rounded-lg bg-black border border-neutral-700 text-sm"
                  placeholder="Weight"
                  value={editWeight}
                  onChange={(e) => setEditWeight(e.target.value)}
                />
                <input
                  type="number"
                  className="p-2 rounded-lg bg-black border border-neutral-700 text-sm"
                  placeholder="Reps"
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
                placeholder="Notes…"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />

              <div className="flex justify-end gap-3">
                <button
                  className="px-4 py-2 text-xs bg-neutral-700 rounded-lg"
                  onClick={() => setEditingId(null)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 text-xs bg-red-600 rounded-lg"
                  onClick={saveEdit}
                >
                  Save
                </button>
              </div>
            </div>
          ) : isConfirmDelete ? (
            /* ============= DELETE CONFIRM ============= */
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
            /* ============= NORMAL VIEW ============= */
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <p className="font-semibold text-[15px] leading-tight">
                  {pr.lift_name}
                </p>

                <div className="flex gap-3">
                  <button onClick={() => startEdit(pr)}>
                    <FaEdit size={16} className="text-red-400" />
                  </button>
                  <button onClick={() => setConfirmDeleteId(pr.id)}>
                    <FaTrashAlt size={16} className="text-red-500" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-neutral-400">
                {pr.weight} {pr.unit} •{" "}
                {pr.reps ? `${pr.reps} reps • ` : ""}
                {pr.date}
              </p>

              {pr.notes && (
                <p className="text-xs text-neutral-500 italic">
                  Notes: {pr.notes}
                </p>
              )}
            </div>
          )}
        </GlowCard>
      </div>
    );
  }

  // ============================
  // MAIN RENDER
  // ============================
  return (
    <div className="p-5 pb-24 bg-black min-h-screen text-white">

      {/* PAGE TITLE */}
      <h1 className="text-3xl font-bold text-red-500 mb-4">
        Personal Records
      </h1>

      {/* ADD PR CARD */}
      <GlowCard>
        <h2 className="text-lg font-semibold text-red-400 mb-3">
          Add New PR
        </h2>

        {/* Lift */}
        <input
          className="w-full p-2 rounded-lg bg-black border border-neutral-700 text-sm mb-3"
          placeholder="Lift name (Bench, Curl, Squat...)"
          value={newLift}
          onChange={(e) => setNewLift(e.target.value)}
        />

        {/* Weight + Reps */}
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

        {/* Unit + Date */}
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

        {/* Notes */}
        <textarea
          className="w-full p-2 rounded-lg bg-black border border-neutral-700 text-sm mb-3"
          placeholder="Notes (optional)"
          value={newNotes}
          onChange={(e) => setNewNotes(e.target.value)}
        />

        {/* Save button */}
        <button
          onClick={handleAddPR}
          className="w-full py-2 bg-red-600 rounded-lg font-bold text-sm"
        >
          Save PR
        </button>
      </GlowCard>

      {/* GROUPS SECTION (ONLY USER-CREATED GROUPS) */}
      {groups.length > 0 &&
        groups.map((group) => {
          // All PRs belonging to this group
          const inside = flatPRs.filter((p) => p.group_id === group.id);

          return (
            <div key={group.id} className="mt-6">
              <GlowCard>
                {/* Group title */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-lg font-bold text-red-400">
                    {group.name}
                  </p>

                  <button
                    className="text-xs text-neutral-500 underline"
                    onClick={() => removeGroup(group.id)}
                  >
                    Delete Group
                  </button>
                </div>

                {/* PRs inside group */}
                {inside.length === 0 ? (
                  <p className="text-xs text-neutral-500">
                    No PRs in this group yet.
                  </p>
                ) : (
                  inside.map((pr) => PRCard(pr))
                )}
              </GlowCard>
            </div>
          );
        })}

      {/* ALL PRs (NOT IN ANY GROUP) */}
      <div className="mt-6">
        {flatPRs
          .filter((p) => !p.group_id)
          .map((pr) => PRCard(pr))}
      </div>
    </div>
  );
}

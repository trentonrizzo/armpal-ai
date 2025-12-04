// src/pages/PRTracker.jsx
import React, { useContext, useMemo, useState, useEffect } from "react";
import { AppContext } from "../context/AppContext";
import { FaEdit, FaTrashAlt } from "react-icons/fa";

export default function PRTracker() {
  const { prs, createPR, removePR, editPR, reorderPRs } =
    useContext(AppContext);

  // NEW: PRs are a flat list now (no categories)
  const [sortMode, setSortMode] = useState("custom");

  // Dragging
  const [draggingId, setDraggingId] = useState(null);

  // Add PR fields
  const [lift, setLift] = useState("");
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState("lbs");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [reps, setReps] = useState("");
  const [notes, setNotes] = useState("");

  // Edit modal
  const [editing, setEditing] = useState(null);
  const [editLift, setEditLift] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editUnit, setEditUnit] = useState("lbs");
  const [editDate, setEditDate] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // ---------------------------
  // Sort Logic
  // ---------------------------
  const sorted = useMemo(() => {
    const list = [...prs];

    switch (sortMode) {
      case "alpha":
        return list.sort((a, b) =>
          (a.lift_name || "").localeCompare(b.lift_name || "")
        );
      case "newest":
        return list.sort(
          (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
        );
      case "heaviest":
        return list.sort((a, b) => (b.weight || 0) - (a.weight || 0));
      default:
        return list.sort(
          (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
        );
    }
  }, [prs, sortMode]);

  // ---------------------------
  // Add PR
  // ---------------------------
  async function saveNewPR() {
    if (!lift.trim() || !weight.trim()) return;

    await createPR(
      lift.trim(),
      Number(weight),
      unit,
      date,
      reps ? Number(reps) : null,
      notes || null
    );

    setLift("");
    setWeight("");
    setUnit("lbs");
    setReps("");
    setNotes("");
    setDate(new Date().toISOString().split("T")[0]);
  }

  // ---------------------------
  // Edit PR
  // ---------------------------
  function openEdit(pr) {
    setEditing(pr);
    setEditLift(pr.lift_name);
    setEditWeight(pr.weight);
    setEditUnit(pr.unit || "lbs");
    setEditDate(pr.date);
    setEditReps(pr.reps || "");
    setEditNotes(pr.notes || "");
  }

  async function saveEdit() {
    if (!editing) return;

    await editPR(editing.id, {
      lift_name: editLift.trim(),
      weight: Number(editWeight),
      unit: editUnit,
      date: editDate,
      reps: editReps ? Number(editReps) : null,
      notes: editNotes || null,
    });

    setEditing(null);
  }

  // ---------------------------
  // Drag + Drop: Hold anywhere on the card
  // ---------------------------
  function startDrag(id) {
    if (sortMode !== "custom") return;
    setDraggingId(id);
  }

  function dragOver(e) {
    if (sortMode !== "custom") return;
    e.preventDefault();
  }

  async function dropCard(targetId) {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      return;
    }

    const list = [...sorted];
    const from = list.findIndex((p) => p.id === draggingId);
    const to = list.findIndex((p) => p.id === targetId);

    if (from === -1 || to === -1) {
      setDraggingId(null);
      return;
    }

    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);

    await reorderPRs(
      list.map((p, i) => ({
        id: p.id,
        order_index: i,
      }))
    );

    setDraggingId(null);
  }

  return (
    <div className="p-5 pb-24 min-h-screen bg-black text-white">

      {/* Title + Sort */}
      <div className="flex items-center justify-between mb-6 fade-in">
        <h1 className="text-3xl font-bold text-red-500">Personal Records</h1>

        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value)}
          className="bg-neutral-900 border border-neutral-700 text-xs rounded-xl px-3 py-2"
        >
          <option value="custom">Custom</option>
          <option value="alpha">A → Z</option>
          <option value="newest">Newest</option>
          <option value="heaviest">Heaviest</option>
        </select>
      </div>

      {/* Add PR Card */}
      <div className="rounded-2xl p-5 mb-8 border border-red-900/40 bg-black/40 pulse-soft">
        <h2 className="text-lg font-semibold text-red-400 mb-4">Add PR</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
          <input
            className="neon-input"
            placeholder="Lift (Bench, Curl...)"
            value={lift}
            onChange={(e) => setLift(e.target.value)}
          />
          <input
            className="neon-input"
            type="number"
            placeholder="Weight"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <select
            className="neon-input"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="lbs">lbs</option>
            <option value="kg">kg</option>
          </select>

          <input
            type="date"
            className="neon-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <input
            className="neon-input"
            type="number"
            placeholder="Reps"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
          />

          <input
            className="neon-input"
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <button
          onClick={saveNewPR}
          className="w-full bg-red-600 py-3 rounded-xl font-bold hover:bg-red-700 shadow-red-500/40 shadow"
        >
          Save PR
        </button>
      </div>
      {/* PR LIST */}
      {sorted.length === 0 ? (
        <p className="text-neutral-500 text-sm fade-in">
          No PRs yet — add your first above.
        </p>
      ) : (
        <div className="space-y-4 fade-in">

          {sorted.map((pr) => (
            <div
              key={pr.id}
              draggable={sortMode === "custom"}
              onDragStart={() => startDrag(pr.id)}
              onDragOver={dragOver}
              onDrop={() => dropCard(pr.id)}
              className={`
                rounded-2xl p-4 border 
                bg-neutral-900/40 
                ${draggingId === pr.id
                  ? "border-red-500 shadow-red-700/40 shadow-lg"
                  : "border-neutral-800 hover:border-red-600"}
                transition-all active:scale-[0.98]
              `}
            >
              <div className="flex items-center justify-between">

                {/* LEFT SECTION */}
                <div>
                  <p className="text-lg font-semibold">{pr.lift_name}</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    {pr.weight} {pr.unit || "lbs"} 
                    {pr.reps ? ` · ${pr.reps} reps` : ""} 
                    {pr.date ? ` · ${pr.date}` : ""}
                  </p>
                  {pr.notes && (
                    <p className="text-xs text-neutral-500 mt-1">
                      {pr.notes}
                    </p>
                  )}
                </div>

                {/* RIGHT ACTION BUTTONS */}
                <div className="flex items-center gap-3">

                  {/* EDIT ICON */}
                  <button
                    onClick={() => openEdit(pr)}
                    className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 transition"
                  >
                    <FaEdit size={16} className="text-red-400" />
                  </button>

                  {/* DELETE ICON */}
                  <button
                    onClick={() => {
                      if (window.confirm("Delete this PR?")) {
                        removePR(pr.id);
                      }
                    }}
                    className="p-2 rounded-xl bg-red-700 hover:bg-red-800 transition"
                  >
                    <FaTrashAlt size={16} className="text-white" />
                  </button>

                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* EDIT MODAL */}
      {editing && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 fade-in">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-red-500 mb-4">Edit PR</h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm text-neutral-400 mb-1 block">Lift</label>
                <input
                  className="neon-input w-full"
                  value={editLift}
                  onChange={(e) => setEditLift(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-neutral-400 mb-1 block">
                    Weight
                  </label>
                  <input
                    type="number"
                    className="neon-input w-full"
                    value={editWeight}
                    onChange={(e) => setEditWeight(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm text-neutral-400 mb-1 block">
                    Unit
                  </label>
                  <select
                    className="neon-input w-full"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                  >
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm text-neutral-400 mb-1 block">Date</label>
                <input
                  type="date"
                  className="neon-input w-full"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-neutral-400 mb-1 block">Reps</label>
                  <input
                    type="number"
                    className="neon-input w-full"
                    value={editReps}
                    onChange={(e) => setEditReps(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm text-neutral-400 mb-1 block">Notes</label>
                  <input
                    className="neon-input w-full"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Modal Buttons */}
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-xl bg-neutral-700 hover:bg-neutral-600 text-sm"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>

              <button
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-semibold"
                onClick={saveEdit}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// src/pages/PRTracker.jsx
console.log("🔥 USING THIS PRTracker.jsx FILE (Supabase direct)");

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

import { FaEdit, FaTrashAlt } from "react-icons/fa";

/* ---------- Sortable wrapper (like workouts) ---------- */
function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: "none",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export default function PRTracker() {
  const [user, setUser] = useState(null);
  const [prs, setPrs] = useState([]);
  const [loading, setLoading] = useState(true);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPr, setEditingPr] = useState(null);

  const [liftName, setLiftName] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [unit, setUnit] = useState("lbs");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  // delete confirm
  const [deleteId, setDeleteId] = useState(null);

  // drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  /* ---------- Load user + PRs ---------- */
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      if (user) await loadPRs(user.id);
      setLoading(false);
    })();
  }, []);

  async function loadPRs(uid) {
    const { data, error } = await supabase
      .from("PRs") // table name
      .select("*")
      .eq("user_id", uid)
      .order("order_index", { ascending: true })
      .order("date", { ascending: false });

    if (error) {
      console.error("Error loading PRs:", error.message);
      return;
    }
    setPrs(data || []);
  }

  /* ---------- Drag reorder ---------- */
  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = prs.findIndex((p) => p.id === active.id);
    const newIndex = prs.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(prs, oldIndex, newIndex);
    setPrs(reordered);

    // save new order_index to Supabase
    for (let i = 0; i < reordered.length; i++) {
      await supabase
        .from("PRs")
        .update({ order_index: i })
        .eq("id", reordered[i].id);
    }
  }

  /* ---------- Open modals ---------- */
  function openAddModal() {
    setEditingPr(null);
    setLiftName("");
    setWeight("");
    setReps("");
    setUnit("lbs");
    setDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setModalOpen(true);
  }

  function openEditModal(pr) {
    setEditingPr(pr);
    setLiftName(pr.lift_name || "");
    setWeight(pr.weight ?? "");
    setReps(pr.reps ?? "");
    setUnit(pr.unit || "lbs");
    setDate(pr.date || new Date().toISOString().slice(0, 10));
    setNotes(pr.notes || "");
    setModalOpen(true);
  }

  /* ---------- Save (add / edit) ---------- */
  async function savePR() {
    if (!user) return;
    if (!liftName.trim() || !weight) return;

    const payload = {
      user_id: user.id,
      lift_name: liftName.trim(),
      weight: Number(weight),
      unit,
      reps: reps === "" ? null : Number(reps),
      date,
      notes: notes || null,
    };

    if (editingPr) {
      await supabase.from("PRs").update(payload).eq("id", editingPr.id);
    } else {
      payload.order_index = prs.length;
      await supabase.from("PRs").insert(payload);
    }

    await loadPRs(user.id);
    setModalOpen(false);
    setEditingPr(null);
  }

  /* ---------- Delete ---------- */
  async function confirmDelete() {
    if (!deleteId) return;
    await supabase.from("PRs").delete().eq("id", deleteId);

    if (user) await loadPRs(user.id);
    setDeleteId(null);
  }

  if (loading) {
    return (
      <div className="p-4 text-white pb-24">
        <p>Loading PRs...</p>
      </div>
    );
  }

  return (
    <div className="p-4 text-white pb-24 min-h-screen">
      {/* Header chip like Measurements */}
      <div className="glass-chip mb-4 text-glow flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="glass-chip-dot" />
          <span>Personal Records</span>
        </div>

        <button
          onClick={openAddModal}
          className="px-3 py-2 bg-red-600 rounded-xl text-sm font-semibold flex items-center gap-1"
        >
          + Add
        </button>
      </div>

      {/* PR LIST */}
      {prs.length === 0 ? (
        <p className="text-gray-400">No PRs yet. Tap “Add” to create one.</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={prs.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            {prs.map((pr) => (
              <SortableItem key={pr.id} id={pr.id}>
                <div className="glass-section p-4 rounded-2xl mb-3 border border-neutral-800 bg-neutral-950/80">
                  {/* Top row: name + buttons on the RIGHT */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-[15px]">
                        {pr.lift_name}
                      </p>
                      <p className="text-neutral-400 text-xs">
                        {pr.weight} {pr.unit}{" "}
                        {pr.reps ? `• ${pr.reps} reps ` : ""}• {pr.date}
                      </p>
                      {pr.notes && (
                        <p className="text-neutral-500 text-xs italic mt-1">
                          {pr.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 ml-4">
                      <button
                        onClick={() => openEditModal(pr)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <FaEdit size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteId(pr.id)}
                        className="text-red-500 hover:text-red-400"
                      >
                        <FaTrashAlt size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </SortableItem>
            ))}
          </SortableContext>
        </DndContext>
      )}

      {/* ADD / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 rounded-2xl border border-neutral-700 p-5 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingPr ? "Edit PR" : "Add PR"}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs opacity-80">Lift Name</label>
                <input
                  className="neon-input w-full"
                  placeholder="Bench Press, Squat, Curl..."
                  value={liftName}
                  onChange={(e) => setLiftName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs opacity-80">Weight</label>
                  <input
                    type="number"
                    className="neon-input w-full"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs opacity-80">Reps</label>
                  <input
                    type="number"
                    className="neon-input w-full"
                    value={reps}
                    onChange={(e) => setReps(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs opacity-80">Unit</label>
                  <select
                    className="neon-input w-full"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  >
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs opacity-80">Date</label>
                  <input
                    type="date"
                    className="neon-input w-full"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs opacity-80">Notes</label>
                <textarea
                  className="neon-input w-full"
                  rows={3}
                  placeholder="Optional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <button
                onClick={() => {
                  setModalOpen(false);
                  setEditingPr(null);
                }}
                className="px-4 py-2 bg-neutral-700 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={savePR}
                className="px-4 py-2 bg-red-600 rounded-xl font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 rounded-2xl border border-neutral-700 p-5 w-full max-w-sm">
            <h2 className="text-xl font-bold mb-3 text-red-400">
              Delete this PR?
            </h2>
            <p className="text-sm text-gray-300 mb-6">
              This action cannot be undone.
            </p>
            <div className="flex justify-between">
              <button
                className="px-4 py-2 bg-neutral-700 rounded-xl"
                onClick={() => setDeleteId(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 rounded-xl"
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

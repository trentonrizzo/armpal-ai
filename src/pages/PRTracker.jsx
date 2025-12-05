// src/pages/PRTracker.jsx
console.log("🔥 USING REAL PRTracker.jsx");

import React, { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { supabase } from "../supabaseClient";
import {
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Check,
} from "lucide-react";

import "../glass.css";

/* ----------------------------------------------
   Sortable wrapper (draggable PR GROUPS)
---------------------------------------------- */
function SortableGroup({ id, children }) {
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

/* ----------------------------------------------
   Sortable wrapper for PR ITEMS within a group
---------------------------------------------- */
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

/* ----------------------------------------------
   MAIN PAGE
---------------------------------------------- */
export default function PRTracker() {
  const [loading, setLoading] = useState(true);

  const [groups, setGroups] = useState({});
  const [groupOrder, setGroupOrder] = useState([]);

  const [expanded, setExpanded] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const [editId, setEditId] = useState(null);

  const [mLift, setMLift] = useState("");
  const [mWeight, setMWeight] = useState("");
  const [mReps, setMReps] = useState("");
  const [mUnit, setMUnit] = useState("lbs");
  const [mDate, setMDate] = useState(new Date().toISOString().slice(0, 10));
  const [mNotes, setMNotes] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  /* ----------------------------------------------
     Load PRs
  ---------------------------------------------- */
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("prs")
        .select("*")
        .eq("user_id", user.id);

      if (error) {
        console.error("PR LOAD ERROR:", error.message);
        return;
      }

      const grouped = {};

      data.forEach((pr) => {
        if (!grouped[pr.lift_name]) grouped[pr.lift_name] = [];
        grouped[pr.lift_name].push(pr);
      });

      // Sort each group newest → oldest
      Object.keys(grouped).forEach((lift) => {
        grouped[lift].sort((a, b) => new Date(b.date) - new Date(a.date));
      });

      setGroups(grouped);
      setGroupOrder(Object.keys(grouped));
      setLoading(false);
    })();
  }, []);

  /* ----------------------------------------------
     Drag group reorder
  ---------------------------------------------- */
  function handleGroupDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setGroupOrder((prev) =>
      arrayMove(prev, prev.indexOf(active.id), prev.indexOf(over.id))
    );
  }

  /* ----------------------------------------------
     Drag PR within group
  ---------------------------------------------- */
  async function handleItemDragEnd(lift, event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setGroups((prev) => {
      const copy = { ...prev };
      copy[lift] = arrayMove(
        copy[lift],
        copy[lift].findIndex((p) => p.id === active.id),
        copy[lift].findIndex((p) => p.id === over.id)
      );
      return copy;
    });
  }

  /* ----------------------------------------------
     OPEN MODALS
  ---------------------------------------------- */
  function openAddModal() {
    setEditId(null);
    setMLift("");
    setMWeight("");
    setMReps("");
    setMUnit("lbs");
    setMDate(new Date().toISOString().slice(0, 10));
    setMNotes("");
    setModalOpen(true);
  }

  function openEditModal(entry) {
    setEditId(entry.id);
    setMLift(entry.lift_name);
    setMWeight(entry.weight);
    setMReps(entry.reps ?? "");
    setMUnit(entry.unit);
    setMDate(entry.date);
    setMNotes(entry.notes || "");
    setModalOpen(true);
  }

  /* ----------------------------------------------
     SAVE ADD/EDIT
  ---------------------------------------------- */
  async function savePR() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (!mLift || !mWeight) return;

    const data = {
      user_id: user.id,
      lift_name: mLift,
      weight: Number(mWeight),
      reps: mReps ? Number(mReps) : null,
      unit: mUnit,
      date: mDate,
      notes: mNotes || null,
    };

    if (editId) {
      await supabase.from("prs").update(data).eq("id", editId);
    } else {
      await supabase.from("prs").insert(data);
    }

    // Reload page instantly (quick way)
    window.location.reload();
  }

  /* ----------------------------------------------
     CONFIRM DELETE
  ---------------------------------------------- */
  async function confirmDelete() {
    await supabase.from("prs").delete().eq("id", deleteId);
    window.location.reload();
  }

  if (loading) return <p className="text-white p-4">Loading...</p>;

  /* ----------------------------------------------
     PAGE UI
  ---------------------------------------------- */
  return (
    <div className="p-4 text-white pb-24">
      {/* Header */}
      <div className="glass-chip mb-4 text-glow flex justify-between items-center">
        <span className="glass-chip-dot" /> Personal Records
        <button
          onClick={openAddModal}
          className="px-3 py-2 bg-red-600 rounded-xl flex items-center gap-1"
        >
          <Plus size={18} /> Add
        </button>
      </div>

      {/* GROUPS */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleGroupDragEnd}
      >
        <SortableContext items={groupOrder} strategy={verticalListSortingStrategy}>
          {groupOrder.map((lift) => {
            const list = groups[lift];
            const latest = list[0];
            const isOpen = expanded[lift];

            return (
              <SortableGroup key={lift} id={lift}>
                <div className="glass-section p-4 rounded-2xl mb-4">
                  {/* Header Row */}
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-semibold text-red-400">{lift}</h2>
                      <p className="text-gray-300 text-sm">
                        {latest.weight} {latest.unit}
                        {latest.reps ? ` • ${latest.reps} reps` : ""} — {latest.date}
                      </p>
                    </div>

                    {/* Right-Side Buttons */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => openEditModal(latest)}
                        className="text-white hover:text-red-400"
                      >
                        <Edit size={20} />
                      </button>

                      <button
                        onClick={() => setDeleteId(latest.id)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 size={20} />
                      </button>

                      <button
                        onClick={() =>
                          setExpanded((prev) => ({ ...prev, [lift]: !prev[lift] }))
                        }
                        className="text-gray-300 hover:text-white"
                      >
                        {isOpen ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
                      </button>
                    </div>
                  </div>

                  {/* Expand List */}
                  {isOpen && (
                    <div className="mt-4">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => handleItemDragEnd(lift, event)}
                      >
                        <SortableContext
                          items={list.map((i) => i.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {list.slice(1).map((entry) => (
                            <SortableItem key={entry.id} id={entry.id}>
                              <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-700 flex justify-between items-center mb-2">
                                <div>
                                  <p className="text-white">
                                    {entry.weight} {entry.unit}
                                    {entry.reps ? ` • ${entry.reps} reps` : ""}
                                  </p>
                                  <p className="text-gray-400 text-xs">{entry.date}</p>
                                  {entry.notes && (
                                    <p className="text-gray-500 text-xs italic">
                                      {entry.notes}
                                    </p>
                                  )}
                                </div>

                                <div className="flex gap-3">
                                  <button
                                    onClick={() => openEditModal(entry)}
                                    className="text-white hover:text-red-400"
                                  >
                                    <Edit size={18} />
                                  </button>

                                  <button
                                    onClick={() => setDeleteId(entry.id)}
                                    className="text-red-400 hover:text-red-600"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </div>
                            </SortableItem>
                          ))}
                        </SortableContext>
                      </DndContext>
                    </div>
                  )}
                </div>
              </SortableGroup>
            );
          })}
        </SortableContext>
      </DndContext>

      {/* ADD/EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 p-5 rounded-2xl w-full max-w-sm border border-neutral-700">
            <h2 className="text-xl font-bold mb-4">
              {editId ? "Edit PR" : "Add PR"}
            </h2>

            <div className="space-y-3">
              <input
                placeholder="Lift name"
                className="neon-input w-full"
                value={mLift}
                onChange={(e) => setMLift(e.target.value)}
              />

              <input
                type="number"
                placeholder="Weight"
                className="neon-input w-full"
                value={mWeight}
                onChange={(e) => setMWeight(e.target.value)}
              />

              <input
                type="number"
                placeholder="Reps"
                className="neon-input w-full"
                value={mReps}
                onChange={(e) => setMReps(e.target.value)}
              />

              <select
                className="neon-input w-full"
                value={mUnit}
                onChange={(e) => setMUnit(e.target.value)}
              >
                <option value="lbs">lbs</option>
                <option value="kg">kg</option>
              </select>

              <input
                type="date"
                className="neon-input w-full"
                value={mDate}
                onChange={(e) => setMDate(e.target.value)}
              />

              <textarea
                className="neon-input w-full"
                placeholder="Notes"
                value={mNotes}
                onChange={(e) => setMNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-between mt-6">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-neutral-700 rounded-xl flex items-center gap-1"
              >
                <X size={18} /> Cancel
              </button>

              <button
                onClick={savePR}
                className="px-4 py-2 bg-red-600 rounded-xl flex items-center gap-1"
              >
                <Check size={18} /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 p-5 rounded-2xl w-full max-w-sm border border-neutral-700">
            <h2 className="text-xl font-bold text-red-400 mb-4">
              Confirm Delete?
            </h2>
            <p className="text-gray-300 mb-6">This action cannot be undone.</p>

            <div className="flex justify-between">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 bg-neutral-700 rounded-xl"
              >
                Cancel
              </button>

              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 rounded-xl"
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

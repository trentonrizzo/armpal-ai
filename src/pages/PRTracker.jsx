console.log("🔥 USING THIS BRAND NEW PRTracker.jsx FILE");

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


/* -------------------------------------------------------
   Sortable WRAPPER for DRAGGING PR groups
------------------------------------------------------- */
function SortableGroupWrapper({ id, children }) {
  const { setNodeRef, attributes, listeners, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}


/* -------------------------------------------------------
   MAIN PAGE
------------------------------------------------------- */
export default function PRTracker() {
  const [prs, setPRs] = useState({});
  const [groupOrder, setGroupOrder] = useState([]);

  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);

  // MODALS
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);

  // FORM FIELDS
  const [liftName, setLiftName] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [unit, setUnit] = useState("lbs");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  // DELETE confirm modal
  const [deleteId, setDeleteId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );


  /* -------------------------------------------------------
     LOAD PRs
  ------------------------------------------------------- */
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("prs")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      const grouped = {};
      data?.forEach((pr) => {
        if (!grouped[pr.lift_name]) grouped[pr.lift_name] = [];
        grouped[pr.lift_name].push(pr);
      });

      // Sort newest → oldest inside each group
      Object.keys(grouped).forEach((key) => {
        grouped[key].sort((a, b) => new Date(b.date) - new Date(a.date));
      });

      setPRs(grouped);
      setGroupOrder(Object.keys(grouped));
      setLoading(false);
    })();
  }, []);


  /* -------------------------------------------------------
     DRAG END — reorder lift groups
  ------------------------------------------------------- */
  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = groupOrder.indexOf(active.id);
    const newIndex = groupOrder.indexOf(over.id);

    setGroupOrder((prev) => arrayMove(prev, oldIndex, newIndex));
  }


  /* -------------------------------------------------------
     OPEN MODALS
  ------------------------------------------------------- */
  function openModalForAdd() {
    setEditId(null);
    setLiftName("");
    setWeight("");
    setReps("");
    setUnit("lbs");
    setDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setModalOpen(true);
  }

  function openModalForEdit(entry) {
    setEditId(entry.id);
    setLiftName(entry.lift_name);
    setWeight(entry.weight);
    setReps(entry.reps ?? "");
    setUnit(entry.unit);
    setDate(entry.date);
    setNotes(entry.notes || "");
    setModalOpen(true);
  }


  /* -------------------------------------------------------
     SAVE (ADD or EDIT)
  ------------------------------------------------------- */
  async function savePR() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (!liftName.trim() || !weight.trim()) return;

    if (editId) {
      await supabase
        .from("prs")
        .update({
          lift_name: liftName.trim(),
          weight: Number(weight),
          reps: reps ? Number(reps) : null,
          unit,
          date,
          notes: notes || null,
        })
        .eq("id", editId);
    } else {
      await supabase.from("prs").insert({
        user_id: user.id,
        lift_name: liftName.trim(),
        weight: Number(weight),
        reps: reps ? Number(reps) : null,
        unit,
        date,
        notes: notes || null,
      });
    }

    // reload
    const { data } = await supabase
      .from("prs")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false });

    const grouped = {};
    data?.forEach((pr) => {
      if (!grouped[pr.lift_name]) grouped[pr.lift_name] = [];
      grouped[pr.lift_name].push(pr);
    });

    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) => new Date(b.date) - new Date(a.date));
    });

    setPRs(grouped);
    setGroupOrder(Object.keys(grouped));

    setModalOpen(false);
  }


  /* -------------------------------------------------------
     CONFIRM DELETE
  ------------------------------------------------------- */
  async function confirmDelete() {
    await supabase.from("prs").delete().eq("id", deleteId);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data } = await supabase
      .from("prs")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false });

    const grouped = {};
    data.forEach((pr) => {
      if (!grouped[pr.lift_name]) grouped[pr.lift_name] = [];
      grouped[pr.lift_name].push(pr);
    });

    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) => new Date(b.date) - new Date(a.date));
    });

    setPRs(grouped);
    setGroupOrder(Object.keys(grouped));

    setDeleteId(null);
  }


  if (loading)
    return <p className="p-4 text-white">Loading...</p>;


  /* -------------------------------------------------------
     UI RENDER
  ------------------------------------------------------- */
  return (
    <div className="p-4 text-white pb-24">

      {/* Header */}
      <div className="glass-chip mb-4 text-glow flex justify-between items-center">
        <span className="glass-chip-dot" /> Personal Records
        <button
          onClick={openModalForAdd}
          className="px-3 py-2 bg-red-600 rounded-xl flex items-center gap-1"
        >
          <Plus size={18} /> Add
        </button>
      </div>


      {/* DRAGGABLE PR GROUPS */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={groupOrder}
          strategy={verticalListSortingStrategy}
        >
          {groupOrder.map((lift) => {
            const items = prs[lift] || [];
            const latest = items[0];
            const isOpen = expanded[lift];

            return (
              <SortableGroupWrapper key={lift} id={lift}>
                <div className="glass-section p-4 rounded-2xl mb-4">

                  {/* TOP ROW */}
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-semibold text-red-400">
                        {lift}
                      </h2>
                      <p className="text-gray-300">
                        {latest.weight} {latest.unit} —{" "}
                        {latest.reps ? `${latest.reps} reps — ` : ""}
                        {latest.date}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">

                      {/* EDIT */}
                      <button
                        onClick={() => openModalForEdit(latest)}
                        className="text-white hover:text-red-400"
                      >
                        <Edit size={20} />
                      </button>

                      {/* DELETE */}
                      <button
                        onClick={() => setDeleteId(latest.id)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 size={20} />
                      </button>

                      {/* TOGGLE */}
                      <button
                        onClick={() =>
                          setExpanded((prev) => ({
                            ...prev,
                            [lift]: !prev[lift],
                          }))
                        }
                        className="ml-2 text-gray-300 hover:text-white"
                      >
                        {isOpen ? (
                          <ChevronUp size={24} />
                        ) : (
                          <ChevronDown size={24} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* HISTORY */}
                  {isOpen && (
                    <div className="mt-4 space-y-2">
                      {items.slice(1).map((entry) => (
                        <div
                          key={entry.id}
                          className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-700 flex justify-between items-center"
                        >
                          <div>
                            <p className="text-white">
                              {entry.weight} {entry.unit} —{" "}
                              {entry.reps ? `${entry.reps} reps` : ""}
                            </p>
                            <p className="text-gray-400 text-sm">
                              {entry.date}
                            </p>
                            {entry.notes && (
                              <p className="text-xs text-neutral-400 italic mt-1">
                                Notes: {entry.notes}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => openModalForEdit(entry)}
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
                      ))}
                    </div>
                  )}
                </div>
              </SortableGroupWrapper>
            );
          })}
        </SortableContext>
      </DndContext>


      {/* ---------------------------------------------------
         ADD / EDIT MODAL
      --------------------------------------------------- */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 p-5 rounded-2xl w-full max-w-sm border border-neutral-700">

            <h2 className="text-xl font-bold mb-4">
              {editId ? "Edit PR" : "Add PR"}
            </h2>

            <div className="space-y-3">

              <div>
                <label className="text-sm opacity-80">Lift Name</label>
                <input
                  value={liftName}
                  onChange={(e) => setLiftName(e.target.value)}
                  className="neon-input w-full"
                  placeholder="Bench Press, Squat, Curl..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm opacity-80">Weight</label>
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="neon-input w-full"
                  />
                </div>

                <div>
                  <label className="text-sm opacity-80">Reps</label>
                  <input
                    type="number"
                    value={reps}
                    onChange={(e) => setReps(e.target.value)}
                    className="neon-input w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm opacity-80">Unit</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="neon-input w-full"
                  >
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm opacity-80">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="neon-input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm opacity-80">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes..."
                  className="neon-input w-full"
                />
              </div>
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


      {/* ---------------------------------------------------
         DELETE CONFIRM MODAL
      --------------------------------------------------- */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 p-5 rounded-2xl w-full max-w-sm border border-neutral-700">

            <h2 className="text-xl font-bold mb-4 text-red-400">
              Confirm Delete?
            </h2>

            <p className="text-gray-300 mb-6">
              This action cannot be undone.
            </p>

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

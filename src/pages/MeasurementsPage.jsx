// ———————————————————————————————
//  MEASUREMENT PAGE — WORKOUTS STYLE
// ———————————————————————————————

import React, { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  getMeasurements,
  addMeasurement,
  updateMeasurement,
  deleteMeasurement,
} from "../api/measurements";

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


// ———————————————————————————————
//  SORTABLE WRAPPER
// ———————————————————————————————
function SortableGroup({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
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


// ———————————————————————————————
//  MAIN PAGE
// ———————————————————————————————
export default function MeasurementsPage() {
  const [measurements, setMeasurements] = useState({});
  const [groupOrder, setGroupOrder] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const [editId, setEditId] = useState(null);
  const [mName, setMName] = useState("");
  const [mValue, setMValue] = useState("");
  const [mUnit, setMUnit] = useState("in");
  const [mDate, setMDate] = useState(new Date().toISOString().slice(0, 10));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // ———————————————————————————————
  // LOAD DATA
  // ———————————————————————————————
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const rows = await getMeasurements(user.id);
      const grouped = {};

      rows.forEach((m) => {
        if (!grouped[m.name]) grouped[m.name] = [];
        grouped[m.name].push(m);
      });

      Object.keys(grouped).forEach((key) =>
        grouped[key].sort((a, b) => new Date(b.date) - new Date(a.date))
      );

      setMeasurements(grouped);
      setGroupOrder(Object.keys(grouped));
      setLoading(false);
    })();
  }, []);

  // ———————————————————————————————
  // DRAG END
  // ———————————————————————————————
  function handleDragEnd(e) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    setGroupOrder((prev) =>
      arrayMove(prev, prev.indexOf(active.id), prev.indexOf(over.id))
    );
  }

  // ———————————————————————————————
  // OPEN MODALS
  // ———————————————————————————————
  function openAdd() {
    setEditId(null);
    setMName("");
    setMValue("");
    setMUnit("in");
    setMDate(new Date().toISOString().slice(0, 10));
    setModalOpen(true);
  }

  function openEdit(entry) {
    setEditId(entry.id);
    setMName(entry.name);
    setMValue(entry.value);
    setMUnit(entry.unit);
    setMDate(entry.date);
    setModalOpen(true);
  }

  // ———————————————————————————————
  // SAVE ADD / EDIT
  // ———————————————————————————————
  async function saveMeasurement() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (!mName || !mValue) return;

    if (editId) {
      await updateMeasurement({
        id: editId,
        name: mName,
        value: mValue,
        unit: mUnit,
        date: mDate,
      });
    } else {
      await addMeasurement({
        userId: user.id,
        name: mName,
        value: mValue,
        unit: mUnit,
        date: mDate,
      });
    }

    // reload
    const rows = await getMeasurements(user.id);
    const grouped = {};

    rows.forEach((m) => {
      if (!grouped[m.name]) grouped[m.name] = [];
      grouped[m.name].push(m);
    });

    Object.keys(grouped).forEach((key) =>
      grouped[key].sort((a, b) => new Date(b.date) - new Date(a.date))
    );

    setMeasurements(grouped);
    setGroupOrder(Object.keys(grouped));
    setModalOpen(false);
  }

  // ———————————————————————————————
  // DELETE CONFIRM
  // ———————————————————————————————
  async function confirmDelete() {
    await deleteMeasurement(deleteId);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const rows = await getMeasurements(user.id);
    const grouped = {};

    rows.forEach((m) => {
      if (!grouped[m.name]) grouped[m.name] = [];
      grouped[m.name].push(m);
    });

    Object.keys(grouped).forEach((key) =>
      grouped[key].sort((a, b) => new Date(b.date) - new Date(a.date))
    );

    setMeasurements(grouped);
    setGroupOrder(Object.keys(grouped));
    setDeleteId(null);
  }

  if (loading) return <p className="p-4 text-white">Loading...</p>;

  // ———————————————————————————————
  // PAGE UI
  // ———————————————————————————————
  return (
    <div className="p-4 text-white pb-24">

      {/* HEADER */}
      <div className="glass-chip flex justify-between items-center mb-4">
        <span className="glass-chip-dot" /> Measurements
        <button
          onClick={openAdd}
          className="px-3 py-2 bg-red-600 rounded-xl flex items-center gap-1"
        >
          <Plus size={18} /> Add
        </button>
      </div>

      {/* LIST */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={groupOrder} strategy={verticalListSortingStrategy}>
          {groupOrder.map((groupName) => {
            const entries = measurements[groupName] || [];
            const latest = entries[0];
            const isOpen = expanded[groupName];

            return (
              <SortableGroup key={groupName} id={groupName}>
                <div className="glass-section p-4 rounded-2xl mb-4">

                  {/* TITLE BAR */}
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-semibold">{groupName}</h2>
                      <p className="text-gray-300">
                        {latest.value} {latest.unit} • {latest.date}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">

                      <button onClick={() => openEdit(latest)} className="text-white hover:text-red-400">
                        <Edit size={20} />
                      </button>

                      <button onClick={() => setDeleteId(latest.id)} className="text-red-400 hover:text-red-600">
                        <Trash2 size={20} />
                      </button>

                      <button
                        onClick={() =>
                          setExpanded((prev) => ({ ...prev, [groupName]: !prev[groupName] }))
                        }
                        className="text-gray-300 hover:text-white"
                      >
                        {isOpen ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
                      </button>
                    </div>
                  </div>

                  {/* HISTORY */}
                  {isOpen && (
                    <div className="mt-4 space-y-2">
                      {entries.slice(1).map((entry) => (
                        <div
                          key={entry.id}
                          className="p-3 bg-neutral-900/60 border border-neutral-700 rounded-xl flex justify-between items-center"
                        >
                          <div>
                            <p className="text-white">
                              {entry.value} {entry.unit}
                            </p>
                            <p className="text-gray-400 text-sm">{entry.date}</p>
                          </div>

                          <div className="flex items-center gap-3">
                            <button onClick={() => openEdit(entry)} className="text-white hover:text-red-400">
                              <Edit size={18} />
                            </button>

                            <button onClick={() => setDeleteId(entry.id)} className="text-red-400 hover:text-red-600">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </SortableGroup>
            );
          })}
        </SortableContext>
      </DndContext>

      {/* ADD / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 p-5 rounded-2xl w-full max-w-sm border border-neutral-700">
            <h2 className="text-xl font-bold mb-4">
              {editId ? "Edit Measurement" : "Add Measurement"}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="text-sm opacity-80">Name</label>
                <input
                  className="neon-input w-full"
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm opacity-80">Value</label>
                <input
                  type="number"
                  className="neon-input w-full"
                  value={mValue}
                  onChange={(e) => setMValue(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm opacity-80">Unit</label>
                <select
                  className="neon-input w-full"
                  value={mUnit}
                  onChange={(e) => setMUnit(e.target.value)}
                >
                  <option value="in">in</option>
                  <option value="cm">cm</option>
                </select>
              </div>

              <div>
                <label className="text-sm opacity-80">Date</label>
                <input
                  type="date"
                  className="neon-input w-full"
                  value={mDate}
                  onChange={(e) => setMDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 bg-neutral-700 rounded-xl flex items-center gap-1">
                <X size={18} /> Cancel
              </button>

              <button onClick={saveMeasurement} className="px-4 py-2 bg-red-600 rounded-xl flex items-center gap-1">
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
            <h2 className="text-xl font-bold text-red-400 mb-4">Confirm Delete?</h2>
            <p className="text-gray-300 mb-6">This action cannot be undone.</p>

            <div className="flex justify-between">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 bg-neutral-700 rounded-xl">
                Cancel
              </button>

              <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 rounded-xl">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

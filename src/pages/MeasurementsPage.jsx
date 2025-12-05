import React, { useEffect, useState } from "react";
import "../glass.css";
import { supabase } from "../supabaseClient";
import {
  getMeasurements,
  addMeasurement,
  deleteMeasurement,
  updateMeasurement,
} from "../api/measurements";
import BottomSheet from "../components/BottomSheet";
import { ChevronDown, ChevronUp, Trash2, Edit3 } from "lucide-react";

export default function MeasurementsPage() {
  const [measurements, setMeasurements] = useState([]);

  // BottomSheet modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Modal inputs
  const [modalName, setModalName] = useState("");
  const [modalValue, setModalValue] = useState("");
  const [modalUnit, setModalUnit] = useState("in");
  const [modalDate, setModalDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // Expand/collapse groups
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    loadMeasurements();
  }, []);

  const loadMeasurements = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const rows = await getMeasurements(user.id);

    // Sort newest first inside each group
    rows.sort((a, b) => new Date(b.date) - new Date(a.date));

    setMeasurements(rows);
  };

  // Group by name
  const grouped = measurements.reduce((acc, m) => {
    if (!acc[m.name]) acc[m.name] = [];
    acc[m.name].push(m);
    return acc;
  }, {});

  // Open modal for add or edit
  const openModal = (m = null) => {
    if (m) {
      setEditingId(m.id);
      setModalName(m.name);
      setModalValue(m.value);
      setModalUnit(m.unit);
      setModalDate(m.date);
    } else {
      setEditingId(null);
      setModalName("");
      setModalValue("");
      setModalUnit("in");
      setModalDate(new Date().toISOString().slice(0, 10));
    }
    setShowModal(true);
  };

  const saveMeasurement = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (!modalName || !modalValue) return;

    if (editingId) {
      await updateMeasurement(editingId, {
        name: modalName,
        value: modalValue,
        unit: modalUnit,
        date: modalDate,
      });
    } else {
      await addMeasurement({
        userId: user.id,
        name: modalName,
        value: modalValue,
        unit: modalUnit,
        date: modalDate,
      });
    }

    setShowModal(false);
    loadMeasurements();
  };

  const handleDelete = async (id) => {
    await deleteMeasurement(id);
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div className="text-white p-4 pb-24">
      {/* Header */}
      <div className="glass-chip mb-4 text-glow">
        <span className="glass-chip-dot" /> Measurements
      </div>

      {/* Add Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => openModal()}
          className="px-4 py-2 bg-red-600 rounded-xl hover:bg-red-700 shadow shadow-red-500/40"
        >
          + Add Measurement
        </button>
      </div>

      {/* History Section */}
      <div className="glass-section p-4 rounded-2xl">
        <div className="glass-chip mb-4 text-glow">
          <span className="glass-chip-dot" /> History
        </div>

        {Object.keys(grouped).length === 0 ? (
          <p className="text-gray-400 text-center">No measurements yet.</p>
        ) : (
          Object.keys(grouped).map((name) => {
            const list = grouped[name];
            const newest = list[0];
            const isOpen = expanded[name] || false;

            return (
              <div key={name} className="mb-6">
                {/* Group Header */}
                <div
                  className="flex justify-between items-center p-3 bg-neutral-900/70 border border-red-900/40 rounded-xl mb-2"
                  onClick={() =>
                    setExpanded((prev) => ({ ...prev, [name]: !isOpen }))
                  }
                >
                  <div>
                    <h3 className="text-xl font-semibold text-red-400">
                      {name}
                    </h3>
                    <p className="text-gray-300 text-sm">
                      {newest.value} {newest.unit} — {newest.date}
                    </p>
                  </div>

                  {isOpen ? (
                    <ChevronUp className="text-red-400" />
                  ) : (
                    <ChevronDown className="text-red-400" />
                  )}
                </div>

                {/* Expanded list */}
                {isOpen && (
                  <ul className="space-y-3">
                    {list.map((m) => (
                      <li
                        key={m.id}
                        className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-700 flex justify-between items-center"
                      >
                        <div>
                          {m.value} {m.unit} — {m.date}
                        </div>

                        <div className="flex gap-3">
                          <Edit3
                            className="text-blue-400 hover:text-blue-600"
                            onClick={() => openModal(m)}
                          />

                          <Trash2
                            className="text-red-400 hover:text-red-600"
                            onClick={() => handleDelete(m.id)}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      <BottomSheet open={showModal} onClose={() => setShowModal(false)}>
        <h3 className="text-xl font-bold mb-4 text-white">
          {editingId ? "Edit Measurement" : "Add Measurement"}
        </h3>

        {/* Name */}
        <div className="mb-3">
          <label className="neon-label">Name</label>
          <input
            type="text"
            className="neon-input w-full"
            value={modalName}
            onChange={(e) => setModalName(e.target.value)}
            placeholder="Bicep, Chest, Wrist..."
          />
        </div>

        {/* Value */}
        <div className="mb-3">
          <label className="neon-label">Value</label>
          <input
            type="number"
            className="neon-input w-full"
            value={modalValue}
            onChange={(e) => setModalValue(e.target.value)}
          />
        </div>

        {/* Unit */}
        <div className="mb-3">
          <label className="neon-label">Unit</label>
          <select
            className="neon-input w-full"
            value={modalUnit}
            onChange={(e) => setModalUnit(e.target.value)}
          >
            <option value="in">in</option>
            <option value="cm">cm</option>
          </select>
        </div>

        {/* Date */}
        <div className="mb-3">
          <label className="neon-label">Date</label>
          <input
            type="date"
            className="neon-input w-full"
            value={modalDate}
            onChange={(e) => setModalDate(e.target.value)}
          />
        </div>

        <div className="flex justify-between mt-4">
          <button
            className="px-4 py-2 bg-neutral-700 rounded-xl"
            onClick={() => setShowModal(false)}
          >
            Cancel
          </button>

          <button
            className="px-4 py-2 bg-red-600 rounded-xl shadow shadow-red-500/40 hover:bg-red-700"
            onClick={saveMeasurement}
          >
            Save
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

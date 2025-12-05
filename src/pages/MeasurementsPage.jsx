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

  // bottom sheet / modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [modalName, setModalName] = useState("");
  const [modalValue, setModalValue] = useState("");
  const [modalUnit, setModalUnit] = useState("in");
  const [modalDate, setModalDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [noDate, setNoDate] = useState(false);

  // which groups are expanded
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    loadMeasurements();
  }, []);

  async function loadMeasurements() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const rows = await getMeasurements(user.id);

    // sort newest first
    rows.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date) - new Date(a.date);
    });

    setMeasurements(rows);
  }

  // group by name
  const grouped = measurements.reduce((acc, m) => {
    if (!acc[m.name]) acc[m.name] = [];
    acc[m.name].push(m);
    return acc;
  }, {});

  function toggleGroup(name) {
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  // open modal for add / edit
  function openModal(measurement = null) {
    if (measurement) {
      setEditingId(measurement.id);
      setModalName(measurement.name);
      setModalValue(measurement.value);
      setModalUnit(measurement.unit || "in");
      setModalDate(measurement.date || new Date().toISOString().slice(0, 10));
      setNoDate(!measurement.date);
    } else {
      setEditingId(null);
      setModalName("");
      setModalValue("");
      setModalUnit("in");
      setModalDate(new Date().toISOString().slice(0, 10));
      setNoDate(false);
    }
    setShowModal(true);
  }

  async function handleSave() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (!modalName || !modalValue) return;

    const payload = {
      name: modalName,
      value: modalValue,
      unit: modalUnit,
      date: noDate ? null : modalDate,
    };

    if (editingId) {
      await updateMeasurement(editingId, payload);
    } else {
      await addMeasurement({
        userId: user.id,
        ...payload,
      });
    }

    setShowModal(false);
    await loadMeasurements();
  }

  async function handleDelete(id) {
    await deleteMeasurement(id);
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <div className="text-white p-4 pb-24 max-w-3xl mx-auto">
      {/* Header */}
      <h1 className="text-2xl font-bold mb-4">Measurements</h1>

      {/* Add button */}
      <div className="mb-4 flex justify-start">
        <button
          onClick={() => openModal()}
          className="px-5 py-2 bg-red-600 rounded-full shadow shadow-red-500/40 hover:bg-red-700 text-sm font-semibold"
        >
          + Add Measurement
        </button>
      </div>

      {/* History / groups */}
      {Object.keys(grouped).length === 0 ? (
        <div className="mt-8 text-center text-gray-400">
          No measurements yet.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.keys(grouped).map((name) => {
            const list = grouped[name];
            const newest = list[0];
            const isOpen = expanded[name] || false;

            const newestDateLabel = newest.date ? newest.date : "No date";

            return (
              <div
                key={name}
                className="bg-neutral-900 rounded-2xl border border-neutral-800 shadow-lg overflow-hidden"
              >
                {/* Card header – like a workout card */}
                <div
                  className="px-4 py-3 flex items-center justify-between cursor-pointer"
                  onClick={() => toggleGroup(name)}
                >
                  <div>
                    <div className="text-sm text-gray-400">MEASUREMENT</div>
                    <div className="text-lg font-semibold uppercase tracking-wide">
                      {name}
                    </div>
                    <div className="text-sm text-gray-300">
                      {newest.value} {newest.unit} — {newestDateLabel}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isOpen ? (
                      <ChevronUp className="text-gray-300" />
                    ) : (
                      <ChevronDown className="text-gray-300" />
                    )}
                  </div>
                </div>

                {/* Expanded history list */}
                {isOpen && (
                  <div className="border-t border-neutral-800">
                    {list.map((m) => {
                      const labelDate = m.date ? m.date : "No date";
                      return (
                        <div
                          key={m.id}
                          className="px-4 py-3 flex items-center justify-between border-t border-neutral-800"
                        >
                          <div className="text-sm text-gray-200">
                            {m.value} {m.unit} — {labelDate}
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => openModal(m)}
                              className="p-1 rounded-full hover:bg-neutral-800"
                            >
                              <Edit3 className="w-4 h-4 text-gray-200" />
                            </button>
                            <button
                              onClick={() => handleDelete(m.id)}
                              className="p-1 rounded-full hover:bg-neutral-800"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* BottomSheet modal for add / edit */}
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

        {/* Date + no-date toggle */}
        <div className="mb-3">
          <label className="neon-label">Date</label>
          <input
            type="date"
            className="neon-input w-full"
            value={noDate ? "" : modalDate}
            onChange={(e) => setModalDate(e.target.value)}
            disabled={noDate}
          />
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-300">
            <input
              id="no-date"
              type="checkbox"
              checked={noDate}
              onChange={(e) => setNoDate(e.target.checked)}
            />
            <label htmlFor="no-date">No date</label>
          </div>
        </div>

        <div className="flex justify-between mt-5">
          <button
            className="px-4 py-2 rounded-xl bg-neutral-700 text-sm"
            onClick={() => setShowModal(false)}
          >
            Cancel
          </button>
          <button
            className="px-5 py-2 rounded-xl bg-red-600 text-sm font-semibold shadow shadow-red-500/40 hover:bg-red-700"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

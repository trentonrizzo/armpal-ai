import React, { useEffect, useState } from "react";
import "../glass.css";
import { supabase } from "../supabaseClient";
import {
  getMeasurements,
  addMeasurement,
  deleteMeasurement,
} from "../api/measurements";

export default function MeasurementsPage() {
  const [unitToggle, setUnitToggle] = useState("in"); // in or cm

  // Default measurement fields
  const [bicep, setBicep] = useState("");
  const [forearm, setForearm] = useState("");
  const [wrist, setWrist] = useState("");
  const [defaultDate, setDefaultDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // Custom modal fields
  const [showModal, setShowModal] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customValue, setCustomValue] = useState("");
  const [customUnit, setCustomUnit] = useState("in");
  const [customDate, setCustomDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // Loaded measurements
  const [measurements, setMeasurements] = useState([]);

  // Load measurements on mount
  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const rows = await getMeasurements(user.id);
      setMeasurements(rows);
    };

    load();
  }, []);

  // Group measurements by name
  const grouped = measurements.reduce((acc, m) => {
    if (!acc[m.name]) acc[m.name] = [];
    acc[m.name].push(m);
    return acc;
  }, {});

  // Save all default measurements at once
  const handleSaveDefaults = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const baseDate = defaultDate;

    const itemsToSave = [
      { name: "Bicep", value: bicep, unit: unitToggle, date: baseDate },
      { name: "Forearm", value: forearm, unit: unitToggle, date: baseDate },
      { name: "Wrist", value: wrist, unit: unitToggle, date: baseDate },
    ];

    for (const item of itemsToSave) {
      if (!item.value) continue;

      await addMeasurement({
        userId: user.id,
        name: item.name,
        value: item.value,
        unit: item.unit,
        date: item.date,
      });
    }

    setBicep("");
    setForearm("");
    setWrist("");

    const rows = await getMeasurements(user.id);
    setMeasurements(rows);
  };

  // Save custom measurement
  const handleSaveCustom = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (!customName || !customValue) return;

    await addMeasurement({
      userId: user.id,
      name: customName,
      value: customValue,
      unit: customUnit,
      date: customDate,
    });

    // Reset modal
    setCustomName("");
    setCustomValue("");
    setCustomUnit("in");
    setShowModal(false);

    const rows = await getMeasurements(user.id);
    setMeasurements(rows);
  };

  const handleDelete = async (id) => {
    await deleteMeasurement(id);
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div className="text-white p-4">
      {/* Top title chip */}
      <div className="glass-chip mb-4 text-glow">
        <span className="glass-chip-dot" /> Measurements
      </div>

      {/* Global unit toggle */}
      <div className="flex gap-4 mb-4">
        <button
          onClick={() => setUnitToggle("in")}
          className={`px-4 py-2 rounded-xl ${
            unitToggle === "in"
              ? "bg-red-600"
              : "bg-neutral-800 border border-neutral-700"
          }`}
        >
          in
        </button>

        <button
          onClick={() => setUnitToggle("cm")}
          className={`px-4 py-2 rounded-xl ${
            unitToggle === "cm"
              ? "bg-red-600"
              : "bg-neutral-800 border border-neutral-700"
          }`}
        >
          cm
        </button>
      </div>

      {/* DEFAULT MEASUREMENTS */}
      <div className="glass-section mb-6 p-4 rounded-2xl">
        <div className="glass-chip mb-3 text-glow">
          <span className="glass-chip-dot" /> Default Measurements
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="neon-label">Bicep ({unitToggle})</label>
            <input
              type="number"
              className="neon-input"
              value={bicep}
              onChange={(e) => setBicep(e.target.value)}
            />
          </div>

          <div>
            <label className="neon-label">Forearm ({unitToggle})</label>
            <input
              type="number"
              className="neon-input"
              value={forearm}
              onChange={(e) => setForearm(e.target.value)}
            />
          </div>

          <div>
            <label className="neon-label">Wrist ({unitToggle})</label>
            <input
              type="number"
              className="neon-input"
              value={wrist}
              onChange={(e) => setWrist(e.target.value)}
            />
          </div>
        </div>

        {/* Date picker */}
        <div className="mb-4">
          <label className="neon-label">Date</label>
          <input
            type="date"
            className="neon-input"
            value={defaultDate}
            onChange={(e) => setDefaultDate(e.target.value)}
          />
        </div>

        <button
          onClick={handleSaveDefaults}
          className="px-5 py-2 bg-red-600 rounded-xl shadow shadow-red-500/40 hover:bg-red-700"
        >
          Save Default Measurements
        </button>
      </div>

      {/* CUSTOM MEASUREMENTS */}
      <div className="glass-section p-4 rounded-2xl mb-6">
        <div className="flex justify-between items-center">
          <div className="glass-chip text-glow">
            <span className="glass-chip-dot" /> Custom Measurements
          </div>

          <button
            className="px-4 py-2 bg-red-600 rounded-xl hover:bg-red-700"
            onClick={() => setShowModal(true)}
          >
            + Add Custom
          </button>
        </div>
      </div>

      {/* HISTORY */}
      <div className="glass-section p-4 rounded-2xl">
        <div className="glass-chip mb-4 text-glow">
          <span className="glass-chip-dot" /> History
        </div>

        {Object.keys(grouped).length === 0 ? (
          <p className="text-gray-400">No measurements yet.</p>
        ) : (
          Object.keys(grouped).map((name) => (
            <div key={name} className="mb-6">
              <h3 className="text-xl font-semibold text-red-400 mb-2">
                {name}
              </h3>

              <ul className="space-y-3">
                {grouped[name].map((m) => (
                  <li
                    key={m.id}
                    className="p-3 bg-neutral-900/70 rounded-xl border border-red-900/40 flex justify-between items-center"
                  >
                    <span>
                      {m.value} {m.unit} — {m.date}
                    </span>

                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-red-400 hover:text-red-600"
                    >
                      ✖
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      {/* CUSTOM MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 className="text-xl font-bold mb-4">Add Custom Measurement</h3>

            <div className="mb-3">
              <label className="neon-label">Name</label>
              <input
                type="text"
                className="neon-input"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
            </div>

            <div className="mb-3">
              <label className="neon-label">Value</label>
              <input
                type="number"
                className="neon-input"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
              />
            </div>

            <div className="mb-3">
              <label className="neon-label">Unit</label>
              <select
                className="neon-input"
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value)}
              >
                <option value="in">in</option>
                <option value="cm">cm</option>
              </select>
            </div>

            <div className="mb-3">
              <label className="neon-label">Date</label>
              <input
                type="date"
                className="neon-input"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
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
                className="px-4 py-2 bg-red-600 rounded-xl"
                onClick={handleSaveCustom}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

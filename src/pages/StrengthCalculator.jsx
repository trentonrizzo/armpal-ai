import React, { useState } from "react";
import BottomSheet from "../components/BottomSheet";
import { AppContext } from "../context/AppContext";
import { useContext } from "react";

export default function StrengthCalculator() {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [oneRM, setOneRM] = useState(null);

  // Toggles
  const [showPercentages, setShowPercentages] = useState(true);
  const [showReps, setShowReps] = useState(true);
  const [showZones, setShowZones] = useState(true);

  // Bottom sheet state (Save PR)
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [prLiftName, setPrLiftName] = useState("");
  const [prDate, setPrDate] = useState(new Date().toISOString().slice(0, 10));

  const { createPR } = useContext(AppContext);

  const calculate1RM = () => {
    if (!weight || !reps) return;

    const w = parseFloat(weight);
    const r = parseFloat(reps);

    const rm = w * (1 + r / 30);
    setOneRM(parseFloat(rm.toFixed(1)));
  };

  const percent = (pct) => (oneRM ? Math.round(oneRM * pct) : 0);
  const repMax = (r) => Math.round(oneRM / (1 + r / 30));

  const savePR = async () => {
    if (!prLiftName) {
      alert("Enter a lift name.");
      return;
    }

    await createPR(prLiftName, oneRM, "lbs", prDate);

    setPrLiftName("");
    setShowSaveSheet(false);
  };

  return (
    <div className="text-white p-4 pb-24">
      
      {/* 🔥 TITLE */}
      <div className="glass-chip mb-4 text-glow">
        <span className="glass-chip-dot" /> Strength Calculator
      </div>

      {/* Input Section */}
      <div className="glass-section p-4 rounded-2xl mb-6">
        <h2 className="text-xl font-bold mb-4">Enter Your Lift</h2>

        <div className="mb-4">
          <label className="neon-label">Weight Lifted</label>
          <input
            type="number"
            className="neon-input w-full"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>

        <div className="mb-4">
          <label className="neon-label">Reps Performed</label>
          <input
            type="number"
            className="neon-input w-full"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
          />
        </div>

        <button
          onClick={calculate1RM}
          className="px-5 py-2 bg-red-600 rounded-xl w-full mt-2 shadow shadow-red-500/40"
        >
          Calculate 1RM
        </button>

        {oneRM && (
          <div className="mt-4">
            <p className="text-lg font-bold text-red-400">
              Estimated 1RM: {oneRM} lbs
            </p>

            {/* 🔥 Save as PR Button */}
            <button
              className="mt-3 w-full bg-neutral-800 border border-red-700 hover:bg-neutral-700 py-2 rounded-xl"
              onClick={() => setShowSaveSheet(true)}
            >
              Save as PR
            </button>
          </div>
        )}
      </div>

      {/* Toggles */}
      <div className="glass-section p-4 rounded-2xl mb-6">
        <h2 className="text-lg font-semibold mb-3">Display Options</h2>

        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={showPercentages}
              onChange={() => setShowPercentages(!showPercentages)}
            />
            Show % Table
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={showReps}
              onChange={() => setShowReps(!showReps)}
            />
            Show Rep Potential
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={showZones}
              onChange={() => setShowZones(!showZones)}
            />
            Show Training Zones
          </label>
        </div>
      </div>

      {/* ⭐ Percentages Table */}
      {showPercentages && oneRM && (
        <div className="glass-section p-4 rounded-2xl mb-6">
          <h2 className="text-lg font-bold mb-3">Percentages Table</h2>

          <div className="space-y-2">
            {[95, 90, 85, 80, 75, 70, 65, 60, 55, 50].map((p) => (
              <div
                key={p}
                className="flex justify-between bg-neutral-900/70 p-2 rounded-xl border border-red-900/40"
              >
                <span>{p}%</span>
                <span>{percent(p / 100)} lbs</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ⭐ Rep Potential */}
      {showReps && oneRM && (
        <div className="glass-section p-4 rounded-2xl mb-6">
          <h2 className="text-lg font-bold mb-3">Rep Potential</h2>

          <div className="space-y-2">
            {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map((r) => (
              <div
                key={r}
                className="flex justify-between bg-neutral-900/70 p-2 rounded-xl border border-red-900/40"
              >
                <span>{r} reps</span>
                <span>{repMax(r)} lbs</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ⭐ Training Zones */}
      {showZones && oneRM && (
        <div className="glass-section p-4 rounded-2xl mb-6">
          <h2 className="text-lg font-bold mb-3">Training Zones</h2>

          <ul className="space-y-3">
            <li className="bg-neutral-900/70 p-3 rounded-xl border border-red-900/40">
              <strong>Hypertrophy (65–80%)</strong> — {percent(0.65)} to {percent(0.8)} lbs
            </li>
            <li className="bg-neutral-900/70 p-3 rounded-xl border border-red-900/40">
              <strong>Strength (80–90%)</strong> — {percent(0.8)} to {percent(0.9)} lbs
            </li>
            <li className="bg-neutral-900/70 p-3 rounded-xl border border-red-900/40">
              <strong>Power (90–100%)</strong> — {percent(0.9)} to {percent(1.0)} lbs
            </li>
          </ul>
        </div>
      )}

      {/* 🔥 SAVE PR BOTTOM SHEET */}
      <BottomSheet open={showSaveSheet} onClose={() => setShowSaveSheet(false)}>
        <h3 className="text-xl font-bold mb-4 text-white">Save as PR</h3>

        <div className="mb-3">
          <label className="neon-label">Lift Name</label>
          <input
            type="text"
            className="neon-input w-full"
            value={prLiftName}
            onChange={(e) => setPrLiftName(e.target.value)}
          />
        </div>

        <div className="mb-3">
          <label className="neon-label">Weight (1RM)</label>
          <input
            type="number"
            className="neon-input w-full"
            value={oneRM}
            readOnly
          />
        </div>

        <div className="mb-3">
          <label className="neon-label">Unit</label>
          <input
            type="text"
            value="lbs"
            readOnly
            className="neon-input w-full"
          />
        </div>

        <div className="mb-3">
          <label className="neon-label">Date</label>
          <input
            type="date"
            className="neon-input w-full"
            value={prDate}
            onChange={(e) => setPrDate(e.target.value)}
          />
        </div>

        <div className="flex justify-between mt-4">
          <button
            className="px-4 py-2 bg-neutral-700 rounded-xl"
            onClick={() => setShowSaveSheet(false)}
          >
            Cancel
          </button>

          <button
            className="px-4 py-2 bg-red-600 rounded-xl"
            onClick={savePR}
          >
            Save PR
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

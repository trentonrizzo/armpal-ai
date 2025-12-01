import React, { useState, useContext } from "react";
import BottomSheet from "../components/BottomSheet";
import { AppContext } from "../context/AppContext";

export default function StrengthCalculator() {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [oneRM, setOneRM] = useState(null);

  // PR Sheet
  const [showPRSheet, setShowPRSheet] = useState(false);
  const [prLiftName, setPrLiftName] = useState("");
  const [prDate, setPrDate] = useState(new Date().toISOString().slice(0, 10));

  const { createPR } = useContext(AppContext);

  const calculate1RM = () => {
    if (!weight || !reps) return;

    const rm = Math.round(weight * (1 + reps / 30));
    setOneRM(rm);
  };

  const savePR = async () => {
    if (!prLiftName) {
      alert("Enter a lift name.");
      return;
    }

    await createPR(prLiftName, oneRM, "lbs", prDate);

    setPrLiftName("");
    setShowPRSheet(false);
  };

  const percentages = [95, 90, 85, 80, 75, 70, 65, 60, 55, 50];
  const repTable = Array.from({ length: 15 }, (_, i) => i + 1);

  return (
    <div className="p-5 text-white min-h-screen bg-black">

      {/* Header Chip */}
      <div className="glass-chip mb-5">
        <span className="glass-chip-dot" /> Strength Calculator
      </div>

      {/* Input Form */}
      <div className="glass-card mb-6">
        <h2 className="text-xl font-bold text-red-400 mb-4">Your Lift</h2>

        <div className="mb-4">
          <label className="neon-label">Weight</label>
          <input
            className="neon-input"
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="Enter weight lifted"
          />
        </div>

        <div className="mb-4">
          <label className="neon-label">Reps</label>
          <input
            className="neon-input"
            type="number"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            placeholder="How many reps?"
          />
        </div>

        <button
          onClick={calculate1RM}
          className="w-full mt-2 py-3 bg-red-600 hover:bg-red-700 font-bold rounded-xl shadow shadow-red-500/40"
        >
          Calculate 1RM
        </button>
      </div>

      {/* RESULTS */}
      {oneRM && (
        <>
          <div className="glass-card mb-6">
            <h2 className="text-xl font-bold text-red-400 mb-2">Estimated 1RM</h2>
            <p className="text-4xl font-bold text-center mt-2">{oneRM} lbs</p>

            {/* ⭐ Save as PR Button */}
            <button
              onClick={() => setShowPRSheet(true)}
              className="w-full mt-4 py-2 bg-neutral-800 border border-red-700 rounded-xl hover:bg-neutral-700"
            >
              Save as PR
            </button>
          </div>

          {/* Percentages */}
          <div className="glass-card mb-6">
            <h3 className="text-lg font-bold text-red-400 mb-4">Percentages</h3>

            <div className="space-y-2">
              {percentages.map((p, i) => (
                <div
                  key={p}
                  className={`flex justify-between p-3 rounded-xl 
                  ${i % 2 === 0 ? "bg-neutral-800/80" : "bg-neutral-900/80"} 
                  border border-neutral-800`}
                >
                  <span>{p}%</span>
                  <span className="font-bold">{Math.round(oneRM * (p / 100))} lbs</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rep Potential */}
          <div className="glass-card mb-6">
            <h3 className="text-lg font-bold text-red-400 mb-4">Rep Potential</h3>

            <div className="space-y-2">
              {repTable.map((r, i) => (
                <div
                  key={r}
                  className={`flex justify-between p-3 rounded-xl 
                  ${i % 2 === 0 ? "bg-neutral-800/80" : "bg-neutral-900/80"}
                  border border-neutral-800`}
                >
                  <span>{r} reps</span>
                  <span className="font-bold">
                    {Math.round(oneRM / (1 + r / 30))} lbs
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Training Zones */}
          <div className="glass-card mb-16">
            <h3 className="text-lg font-bold text-red-400 mb-4">Training Zones</h3>

            <ul className="space-y-3">
              <li className="p-3 rounded-xl bg-neutral-800/80 border border-neutral-700">
                <strong className="text-red-400">Strength:</strong> 85–100%
              </li>
              <li className="p-3 rounded-xl bg-neutral-800/80 border border-neutral-700">
                <strong className="text-red-400">Hypertrophy:</strong> 65–85%
              </li>
              <li className="p-3 rounded-xl bg-neutral-800/80 border border-neutral-700">
                <strong className="text-red-400">Endurance:</strong> 50–65%
              </li>
            </ul>
          </div>
        </>
      )}

      {/* ⭐ BOTTOM SHEET: SAVE PR */}
      <BottomSheet open={showPRSheet} onClose={() => setShowPRSheet(false)}>
        <h2 className="text-xl font-bold text-white mb-4">Save as PR</h2>

        <div className="mb-3">
          <label className="neon-label">Lift Name</label>
          <input
            className="neon-input"
            type="text"
            value={prLiftName}
            onChange={(e) => setPrLiftName(e.target.value)}
            placeholder="Bench, Squat, Deadlift..."
          />
        </div>

        <div className="mb-3">
          <label className="neon-label">Weight (1RM)</label>
          <input
            className="neon-input"
            type="number"
            value={oneRM}
            readOnly
          />
        </div>

        <div className="mb-3">
          <label className="neon-label">Unit</label>
          <input className="neon-input" type="text" value="lbs" readOnly />
        </div>

        <div className="mb-3">
          <label className="neon-label">Date</label>
          <input
            className="neon-input"
            type="date"
            value={prDate}
            onChange={(e) => setPrDate(e.target.value)}
          />
        </div>

        <div className="flex justify-between mt-6">
          <button
            className="px-4 py-2 bg-neutral-700 rounded-xl"
            onClick={() => setShowPRSheet(false)}
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

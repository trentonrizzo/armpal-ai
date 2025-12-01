import React, { useState } from "react";

export default function StrengthCalculator() {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [oneRM, setOneRM] = useState(null);

  const calculate1RM = () => {
    if (!weight || !reps) return;

    // Epley Formula
    const rm = Math.round(weight * (1 + reps / 30));
    setOneRM(rm);
  };

  const percentages = [95, 90, 85, 80, 75, 70, 65, 60, 55, 50];
  const repTable = Array.from({ length: 15 }, (_, i) => i + 1);

  return (
    <div className="p-5 text-white min-h-screen bg-black">

      <h1 className="text-3xl font-bold text-red-500 mb-5">1RM Calculator</h1>

      {/* Input Card */}
      <div className="bg-neutral-900/80 p-4 rounded-2xl border border-neutral-800 mb-6 shadow-lg">
        <label className="block text-red-400 mb-1 font-semibold">Weight</label>
        <input
          className="w-full p-3 rounded-xl bg-neutral-800 border border-neutral-700 mb-3"
          type="number"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />

        <label className="block text-red-400 mb-1 font-semibold">Reps</label>
        <input
          className="w-full p-3 rounded-xl bg-neutral-800 border border-neutral-700 mb-4"
          type="number"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
        />

        <button
          onClick={calculate1RM}
          className="w-full p-3 rounded-xl bg-red-600 hover:bg-red-700 font-bold shadow shadow-red-500/30"
        >
          Calculate
        </button>
      </div>

      {/* Results */}
      {oneRM && (
        <div className="space-y-6">

          {/* 1RM Display */}
          <div className="bg-neutral-900/80 p-5 rounded-2xl border border-red-900 shadow-lg">
            <h2 className="text-xl font-bold text-red-400 mb-2">Your Estimated 1RM</h2>
            <p className="text-3xl font-bold">{oneRM} lbs</p>
          </div>

          {/* Percentages */}
          <div className="bg-neutral-900/80 p-5 rounded-2xl border border-neutral-800 shadow-lg">
            <h2 className="text-xl font-bold text-red-400 mb-3">Percentages Table</h2>

            <div className="space-y-2">
              {percentages.map((p) => (
                <div
                  key={p}
                  className="flex justify-between bg-neutral-800 p-3 rounded-xl"
                >
                  <span>{p}%</span>
                  <span className="font-bold">{Math.round(oneRM * (p / 100))} lbs</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rep Potential */}
          <div className="bg-neutral-900/80 p-5 rounded-2xl border border-neutral-800 shadow-lg">
            <h2 className="text-xl font-bold text-red-400 mb-3">Rep Potential</h2>

            <div className="space-y-2">
              {repTable.map((r) => (
                <div
                  key={r}
                  className="flex justify-between bg-neutral-800 p-3 rounded-xl"
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
          <div className="bg-neutral-900/80 p-5 rounded-2xl border border-neutral-800 shadow-lg">
            <h2 className="text-xl font-bold text-red-400 mb-3">Training Zones</h2>

            <ul className="space-y-2">
              <li className="bg-neutral-800 rounded-xl p-3">
                <span className="font-bold text-red-400">Strength</span> — 85–100%
              </li>
              <li className="bg-neutral-800 rounded-xl p-3">
                <span className="font-bold text-red-400">Hypertrophy</span> — 65–85%
              </li>
              <li className="bg-neutral-800 rounded-xl p-3">
                <span className="font-bold text-red-400">Endurance</span> — 50–65%
              </li>
            </ul>
          </div>

        </div>
      )}
    </div>
  );
}

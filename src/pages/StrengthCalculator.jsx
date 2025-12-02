// src/pages/StrengthCalculator.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function StrengthCalculator() {
  const [liftName, setLiftName] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [oneRM, setOneRM] = useState(null);
  const [currentPR, setCurrentPR] = useState(null);

  // Rep multipliers
  const repMultipliers = {
    1: 1.0,
    2: 1.05,
    3: 1.08,
    4: 1.12,
    5: 1.15,
    6: 1.18,
    7: 1.20,
    8: 1.22,
    9: 1.24,
    10: 1.27,
  };

  // Percent table
  const percentages = [
    { pct: 95, reps: 1 },
    { pct: 90, reps: 2 },
    { pct: 85, reps: 3 },
    { pct: 80, reps: 5 },
    { pct: 75, reps: 8 },
    { pct: 70, reps: 10 },
    { pct: 65, reps: 12 },
    { pct: 60, reps: 15 },
  ];

  // Load current PR
  useEffect(() => {
    async function loadPR() {
      if (!liftName) return;

      const cleanName = liftName.toLowerCase().trim();

      const { data } = await supabase
        .from("prs")
        .select("weight")
        .eq("lift_name", cleanName)
        .order("weight", { ascending: false })
        .limit(1);

      setCurrentPR(data?.[0]?.weight || null);
    }

    loadPR();
  }, [liftName]);

  // 1RM calculation
  function calculateOneRM() {
    if (!weight || !reps) return;

    const w = Number(weight);
    const r = Number(reps);

    const multiplier = repMultipliers[r] || (1 + r * 0.03);
    const est = Math.round(w * multiplier);

    setOneRM(est);
  }

  // Save PR
  async function savePR() {
    if (!liftName || !oneRM) return;

    const cleanName = liftName.toLowerCase().trim();

    await supabase.from("prs").insert({
      lift_name: cleanName,
      weight: oneRM,
    });

    setCurrentPR(oneRM);
  }

  return (
    <div className="text-white p-4 pb-32">
      <h1 className="text-2xl font-bold mb-6">Strength Calculator</h1>

      {/* INPUT CARD */}
      <div className="bg-[#111] p-5 rounded-xl border border-gray-800 mb-6 shadow-lg">
        <h2 className="text-lg mb-3 font-semibold text-red-400">Your Lift</h2>

        {/* Lift Name */}
        <input
          type="text"
          placeholder="Lift name (bench, squat)"
          value={liftName}
          onChange={(e) => setLiftName(e.target.value)}
          className="w-full mb-4 p-3 bg-black border border-gray-700 rounded-lg"
        />

        {/* Weight + Reps row */}
        <div className="flex gap-3 mb-4">
          <input
            type="number"
            placeholder="Weight"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="flex-1 p-3 bg-black border border-gray-700 rounded-lg"
          />
          <input
            type="number"
            placeholder="Reps"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="w-28 p-3 bg-black border border-gray-700 rounded-lg"
          />
        </div>

        {/* Calc Button */}
        <button
          onClick={calculateOneRM}
          className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-700 transition font-semibold"
        >
          Calculate 1RM
        </button>
      </div>

      {/* 1RM RESULTS */}
      {oneRM && (
        <div className="bg-[#111] p-5 rounded-xl border border-gray-800 mb-6 shadow-lg">
          <h2 className="text-xl font-bold text-red-400 mb-2">Estimated 1RM</h2>

          <p className="text-4xl font-extrabold text-white mb-3">{oneRM} lbs</p>

          <div className="w-full h-[2px] bg-red-700 mb-4"></div>

          {/* PR COMPARISON */}
          {currentPR !== null ? (
            <div className="mb-3 text-sm">
              <p className="text-gray-400 mb-1">PR Comparison</p>
              <p>Current PR: {currentPR} lbs</p>
              <p>Your 1RM: {oneRM} lbs</p>

              <p className="mt-1">
                Difference:{" "}
                <span className="font-semibold text-red-400">
                  {oneRM - currentPR} lbs
                </span>
              </p>

              {oneRM > currentPR && (
                <p className="text-red-400 font-bold mt-1">🔥 NEW PR POSSIBLE</p>
              )}

              {oneRM > currentPR && (
                <button
                  onClick={savePR}
                  className="w-full py-2 mt-3 bg-red-700 rounded-lg hover:bg-red-800 transition"
                >
                  Save as PR
                </button>
              )}
            </div>
          ) : (
            <p className="text-gray-500 italic mb-2">
              No PR saved yet for this lift.
            </p>
          )}
        </div>
      )}

      {/* PERCENTAGES TABLE */}
      {oneRM && (
        <div className="bg-[#111] p-5 rounded-xl border border-gray-800 shadow-lg">
          <h2 className="text-xl font-bold mb-4">Percentages</h2>

          <div className="grid grid-cols-2 gap-y-3 text-sm">
            {percentages.map((row) => (
              <React.Fragment key={row.pct}>
                {/* LEFT COLUMN */}
                <div className="flex flex-col">
                  <span className="text-gray-300 font-medium">
                    {row.pct}% — {Math.round(oneRM * (row.pct / 100))} lbs
                  </span>
                </div>

                {/* RIGHT COLUMN */}
                <div className="flex flex-col items-end">
                  <span className="text-gray-300">
                    {row.reps} reps —{" "}
                    <span className="text-red-400 font-semibold">
                      {Math.round(oneRM / repMultipliers[row.reps])} lbs
                    </span>
                  </span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

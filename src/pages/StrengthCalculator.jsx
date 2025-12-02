// src/pages/StrengthCalculator.jsx
import React, { useState } from "react";

export default function StrengthCalculator() {
  const [weight, setWeight] = useState("");
  const [oneRepMax, setOneRepMax] = useState(null);

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

  function calculate1RM() {
    if (!weight || isNaN(weight)) return;
    setOneRepMax(weight);
  }

  return (
    <div className="text-white p-4 pb-24">
      <h2 className="text-xl font-semibold mb-3 text-center">
        Strength Calculator
      </h2>

      <div className="flex gap-2 mb-4">
        <input
          type="number"
          placeholder="Enter weight"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="flex-1 p-2 bg-[#111] border border-gray-700 rounded"
        />
        <button
          onClick={calculate1RM}
          className="px-4 py-2 bg-red-600 rounded font-medium"
        >
          Calc
        </button>
      </div>

      {oneRepMax && (
        <div className="bg-[#111] p-3 rounded-lg border border-gray-800">
          <h3 className="text-lg font-semibold mb-2 text-center">
            Results Based on 1RM: {oneRepMax} lbs
          </h3>

          <div className="grid grid-cols-2 text-sm gap-y-2">
            {percentages.map((row) => (
              <React.Fragment key={row.pct}>
                <div className="flex justify-start pr-2">
                  <span>{row.pct}%</span>
                </div>
                <div className="flex justify-end pl-2">
                  <span>{row.reps} reps</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

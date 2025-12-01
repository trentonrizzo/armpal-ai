// src/pages/PRTracker.jsx
import React, { useContext, useState } from "react";
import { AppContext } from "../context/AppContext";
import { Link } from "react-router-dom";

export default function PRTracker() {
  const { prs, createPR, removePR } = useContext(AppContext);

  const [lift, setLift] = useState("");
  the [weight, setWeight] = useState("");
  const [unit, setUnit] = useState("lbs");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const handleSave = async () => {
    if (!lift.trim() || !weight.trim()) {
      alert("Enter lift name and weight");
      return;
    }

    await createPR(lift.trim(), Number(weight), unit, date);

    setLift("");
    setWeight("");
    setUnit("lbs");
  };

  return (
    <div className="p-6 text-white min-h-screen">

      {/* Title */}
      <h1 className="text-3xl font-bold text-red-500 mb-4">
        Personal Records
      </h1>

      {/* Strength Calculator Button */}
      <Link to="/strength">
        <button className="w-full mb-6 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-bold text-white shadow shadow-red-500/40">
          🔥 1RM & Strength Calculator
        </button>
      </Link>

      {/* Add PR */}
      <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 mb-6">
        <h2 className="text-lg font-semibold text-red-400 mb-3">
          Add New PR
        </h2>

        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Lift (Bench, Squat…)"
            className="p-3 rounded bg-neutral-800"
            value={lift}
            onChange={(e) => setLift(e.target.value)}
          />

          <input
            type="number"
            placeholder="Weight"
            className="p-3 rounded bg-neutral-800"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />

          <select
            className="p-3 rounded bg-neutral-800"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="lbs">lbs</option>
            <option value="kg">kg</option>
          </select>

          <input
            type="date"
            className="p-3 rounded bg-neutral-800"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <button
            onClick={handleSave}
            className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-xl font-bold"
          >
            Save PR
          </button>
        </div>
      </div>

      {/* PR List */}
      <h2 className="text-lg font-semibold text-red-400 mb-2">
        Your PRs
      </h2>

      {prs.length === 0 ? (
        <p className="text-neutral-500">No PRs yet.</p>
      ) : (
        <ul className="space-y-3">
          {prs.map((p) => (
            <li
              key={p.id}
              className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl flex justify-between"
            >
              <div>
                <p className="font-semibold text-white">{p.lift_name}</p>
                <p className="text-neutral-400">
                  {p.weight} {p.unit} — {p.date}
                </p>
              </div>

              <button
                onClick={() => removePR(p.id)}
                className="bg-red-700 hover:bg-red-800 px-3 py-1 rounded"
              >
                ❌
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

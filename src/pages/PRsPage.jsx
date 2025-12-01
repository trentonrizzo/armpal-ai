import React, { useContext, useState } from "react";
import { AppContext } from "../context/AppContext";
import { Link } from "react-router-dom";

const PRsPage = () => {
  const { prs, createPR, removePR } = useContext(AppContext);

  const [liftName, setLiftName] = useState("");
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState("lbs");
  const [date, setDate] = useState("");

  const handleAddPR = async () => {
    if (!liftName || !weight) {
      alert("Enter lift name and weight.");
      return;
    }

    const prDate = date || new Date().toISOString().split("T")[0];

    await createPR(liftName, weight, unit, prDate);

    setLiftName("");
    setWeight("");
    setUnit("lbs");
    setDate("");
  };

  return (
    <div className="p-6 text-white min-h-screen bg-black">

      {/* PAGE CHIP */}
      <div className="glass-chip mb-4">
        <span className="glass-chip-dot" /> Personal Records
      </div>

      {/* 🔥 Strength Calculator Button */}
      <Link to="/strength-calculator">
        <button className="w-full mb-6 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-bold text-white shadow shadow-red-500/40">
          🔥 1RM & Strength Calculator
        </button>
      </Link>

      {/* Add PR Form */}
      <div className="glass-card mb-6">
        <h2 className="text-lg font-semibold mb-2 text-red-400">Add New PR</h2>

        <div className="flex flex-col gap-4 mt-3">

          <div>
            <label className="neon-label">Lift Name</label>
            <input
              type="text"
              placeholder="Bench Press, Squat, Curl..."
              className="neon-input"
              value={liftName}
              onChange={(e) => setLiftName(e.target.value)}
            />
          </div>

          <div>
            <label className="neon-label">Weight</label>
            <input
              type="number"
              placeholder="Weight"
              className="neon-input"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>

          <div>
            <label className="neon-label">Unit</label>
            <select
              className="neon-input"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              <option value="lbs">lbs</option>
              <option value="kg">kg</option>
            </select>
          </div>

          <div>
            <label className="neon-label">Date</label>
            <input
              type="date"
              className="neon-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <button
            onClick={handleAddPR}
            className="bg-red-600 hover:bg-red-700 p-3 rounded-xl font-bold shadow shadow-red-500/40"
          >
            Add PR
          </button>
        </div>
      </div>

      {/* Show PR list */}
      {prs.length === 0 ? (
        <p className="text-neutral-400">No PRs yet. Add one above.</p>
      ) : (
        <ul className="space-y-3 mb-20">
          {prs.map((p) => (
            <li
              key={p.id}
              className="glass-card flex justify-between items-center py-4 px-4"
            >
              <div>
                <p className="text-lg font-bold text-red-400">{p.lift_name}</p>
                <p className="text-neutral-300 text-sm">
                  {p.weight} {p.unit} — {p.date}
                </p>
              </div>

              <button
                onClick={() => removePR(p.id)}
                className="bg-red-700 hover:bg-red-800 p-2 rounded"
              >
                ❌
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PRsPage;

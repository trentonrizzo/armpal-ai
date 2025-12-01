import React, { useContext, useState } from "react";
import { AppContext } from "../context/AppContext";
import { Link } from "react-router-dom";

const PRsPage = () => {
  const {
    prs,
    createPR,
    removePR
  } = useContext(AppContext);

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
    <div className="p-6 text-white min-h-screen">
      <h1 className="text-3xl font-bold text-red-500 mb-4">Personal Records</h1>

      {/* 🔥 Strength Calculator Button */}
      <Link to="/strength">
        <button className="
          w-full mb-6 py-3 
          bg-red-600 hover:bg-red-700 
          rounded-xl font-bold text-white 
          shadow shadow-red-500/40
        ">
          🔥 1RM & Strength Calculator
        </button>
      </Link>

      {/* Add PR form */}
      <div className="bg-neutral-900 p-4 rounded-xl mb-6 border border-neutral-800">
        <h2 className="text-lg font-semibold mb-2 text-red-400">
          Add New PR
        </h2>

        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Lift Name (Bench, Squat, etc.)"
            className="p-2 rounded bg-neutral-800"
            value={liftName}
            onChange={(e) => setLiftName(e.target.value)}
          />

          <input
            type="number"
            placeholder="Weight"
            className="p-2 rounded bg-neutral-800"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />

          <select
            className="p-2 rounded bg-neutral-800"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="lbs">lbs</option>
            <option value="kg">kg</option>
          </select>

          <input
            type="date"
            className="p-2 rounded bg-neutral-800"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <button
            onClick={handleAddPR}
            className="bg-red-600 hover:bg-red-700 p-2 rounded font-bold"
          >
            Add PR
          </button>
        </div>
      </div>

      {/* Show PR list */}
      {prs.length === 0 ? (
        <p className="text-neutral-400">No PRs yet. Add one above.</p>
      ) : (
        <ul className="space-y-3">
          {prs.map((p) => (
            <li
              key={p.id}
              className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl flex justify-between items-center"
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

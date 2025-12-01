import React, { useState, useContext, useMemo } from "react";
import { AppContext } from "../context/AppContext";
import { Link } from "react-router-dom";

export default function PRTracker() {
  const { prs, createPR, removePR } = useContext(AppContext);

  // Add PR form state
  const [lift, setLift] = useState("");
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState("lbs");

  // Sorting
  const [sortType, setSortType] = useState("recent");

  const handleSave = async () => {
    if (!lift.trim() || !weight.trim()) return;

    const date = new Date().toISOString().split("T")[0];

    await createPR(lift, Number(weight), unit, date);

    setLift("");
    setWeight("");
  };

  // ----- SORT LOGIC -----
  const sortedPRs = useMemo(() => {
    const p = [...prs];

    switch (sortType) {
      case "recent":
        return p.sort((a, b) => new Date(b.date) - new Date(a.date));
      case "oldest":
        return p.sort((a, b) => new Date(a.date) - new Date(b.date));
      case "az":
        return p.sort((a, b) => a.lift_name.localeCompare(b.lift_name));
      case "za":
        return p.sort((a, b) => b.lift_name.localeCompare(a.lift_name));
      case "heaviest":
        return p.sort((a, b) => b.weight - a.weight);
      case "lightest":
        return p.sort((a, b) => a.weight - b.weight);
      default:
        return p;
    }
  }, [prs, sortType]);

  return (
    <div className="p-6 text-white space-y-6 min-h-screen">

      {/* PAGE TITLE */}
      <h1 className="text-3xl font-bold text-red-500">Personal Records</h1>

      {/* Strength Calculator */}
      <Link to="/strength">
        <button className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 shadow text-white font-bold">
          🔥 1RM & Strength Calculator
        </button>
      </Link>

      {/* SORT DROPDOWN */}
      <div className="flex items-center gap-3">
        <span className="text-gray-300 text-sm">Sort:</span>

        <select
          className="bg-neutral-900 border border-neutral-700 p-2 rounded-lg"
          value={sortType}
          onChange={(e) => setSortType(e.target.value)}
        >
          <option value="recent">Recent</option>
          <option value="oldest">Oldest</option>
          <option value="az">A → Z</option>
          <option value="za">Z → A</option>
          <option value="heaviest">Heaviest</option>
          <option value="lightest">Lightest</option>
        </select>
      </div>

      {/* ADD NEW PR */}
      <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 space-y-3">
        <h2 className="text-lg font-bold text-red-400">Add New PR</h2>

        <input
          className="w-full p-2 rounded bg-neutral-800"
          placeholder="Lift name (Bench, Squat, etc.)"
          value={lift}
          onChange={(e) => setLift(e.target.value)}
        />

        <input
          className="w-full p-2 rounded bg-neutral-800"
          placeholder="Weight"
          type="number"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />

        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="p-2 rounded bg-neutral-800 w-full"
        >
          <option value="lbs">lbs</option>
          <option value="kg">kg</option>
        </select>

        <button
          onClick={handleSave}
          className="w-full py-2 bg-red-600 hover:bg-red-700 rounded-lg font-bold"
        >
          Save PR
        </button>
      </div>

      {/* PR LIST */}
      <div className="space-y-4 pb-20">
        {sortedPRs.length === 0 ? (
          <p className="text-gray-400">You have no PRs yet.</p>
        ) : (
          sortedPRs.map((p) => (
            <div
              key={p.id}
              className="bg-neutral-900 p-4 rounded-xl border border-neutral-800"
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-lg font-bold text-red-400">{p.lift_name}</p>
                  <p className="text-gray-300 text-sm">
                    {p.weight} {p.unit} — {p.date}
                  </p>
                </div>

                <button
                  onClick={() => removePR(p.id)}
                  className="px-3 py-1 bg-red-700 hover:bg-red-800 rounded-lg"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}

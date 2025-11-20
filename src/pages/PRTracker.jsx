import React, { useState, useContext } from "react";
import { AppContext } from "../context/AppContext";
import PRPopup from "../components/PRPopup";
import PREditPopup from "../components/PREditPopup";

export default function PRTracker() {
  const { prs, createPR, removePR } = useContext(AppContext);

  const [lift, setLift] = useState("");
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState("lbs");

  const [popupData, setPopupData] = useState(null);
  const [editingPR, setEditingPR] = useState(null);

  const handleSave = async () => {
    if (!lift.trim() || !weight.trim()) return;

    const date = new Date().toISOString();
    await createPR(lift, Number(weight), unit, date);

    setPopupData({ lift, weight, unit });

    setLift("");
    setWeight("");
  };

  return (
    <div className="text-white p-6">

      {/* NEW PR POPUP */}
      {popupData && (
        <PRPopup
          lift={popupData.lift}
          weight={popupData.weight}
          unit={popupData.unit}
          onClose={() => setPopupData(null)}
        />
      )}

      {/* EDIT PR POPUP */}
      {editingPR && (
        <PREditPopup
          pr={editingPR}
          onSave={async (updated) => {
            // update in DB
            await supabase
              .from("PRs")
              .update({
                lift_name: updated.lift_name,
                weight: updated.weight,
                unit: updated.unit,
              })
              .eq("id", updated.id);

            setEditingPR(null);
          }}
          onClose={() => setEditingPR(null)}
        />
      )}

      <h1 className="text-2xl font-bold text-red-500 mb-4">Personal Records</h1>

      <div className="mb-6 space-y-3">
        <div>
          <label className="text-sm text-gray-400">Lift</label>
          <input
            className="w-full p-2 rounded bg-neutral-900 border border-neutral-700"
            placeholder="Bench press, squat…"
            value={lift}
            onChange={(e) => setLift(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm text-gray-400">Weight</label>
          <input
            className="w-full p-2 rounded bg-neutral-900 border border-neutral-700"
            placeholder="225"
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>

        <button
          onClick={handleSave}
          className="w-full py-2 bg-red-600 rounded-lg font-semibold"
        >
          Save PR
        </button>
      </div>

      <h2 className="text-red-400 text-lg mb-2">Your PRs</h2>

      {prs.length === 0 ? (
        <p className="text-gray-500">No PRs recorded.</p>
      ) : (
        <ul className="space-y-3">
          {prs.map((p) => (
            <li
              key={p.id}
              className="p-3 bg-neutral-900 border border-neutral-700 rounded-lg flex justify-between items-center"
            >
              <div onClick={() => setEditingPR(p)} className="flex-1 cursor-pointer">
                <p className="font-semibold text-white">{p.lift_name}</p>
                <p className="text-gray-400">
                  {p.weight} {p.unit}
                </p>
              </div>

              <button
                onClick={() => removePR(p.id)}
                className="text-red-400 hover:text-red-600 text-2xl pl-4"
              >
                ✖
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

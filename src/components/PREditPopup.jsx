import React, { useState } from "react";

export default function PREditPopup({ pr, onSave, onClose }) {
  const [lift, setLift] = useState(pr.lift_name);
  const [weight, setWeight] = useState(pr.weight);
  const [unit, setUnit] = useState(pr.unit);

  const submit = () => {
    if (!lift.trim() || !weight) return;
    onSave({
      id: pr.id,
      lift_name: lift,
      weight: Number(weight),
      unit,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-neutral-900 border border-red-700 rounded-2xl p-6 w-80 text-center shadow-xl shadow-red-900/40 animate-fadeIn">

        <h2 className="text-red-400 text-xl font-bold mb-4">Edit PR</h2>

        <div className="space-y-3">
          <div>
            <label className="text-gray-400 text-sm">Lift</label>
            <input
              className="w-full p-2 rounded bg-neutral-800 border border-neutral-700 text-white"
              value={lift}
              onChange={(e) => setLift(e.target.value)}
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm">Weight</label>
            <input
              className="w-full p-2 rounded bg-neutral-800 border border-neutral-700 text-white"
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm">Unit</label>
            <select
              className="w-full p-2 rounded bg-neutral-800 border border-neutral-700 text-white"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              <option value="lbs">lbs</option>
              <option value="kg">kg</option>
            </select>
          </div>
        </div>

        <div className="flex mt-6 gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-neutral-700 rounded-xl font-bold"
          >
            Cancel
          </button>

          <button
            onClick={submit}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded-xl font-bold"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

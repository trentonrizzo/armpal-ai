import React from "react";

export default function PRPopup({ lift, weight, unit, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-neutral-900 border border-red-700 rounded-2xl p-6 w-80 text-center shadow-xl shadow-red-900/40 animate-fadeIn">

        <h2 className="text-red-400 text-xl font-bold mb-2">🔥 NEW PR UNLOCKED 🔥</h2>

        <p className="text-white text-lg font-semibold mb-1">
          {lift}
        </p>

        <p className="text-red-300 text-3xl font-bold mb-4">
          {weight} {unit}
        </p>

        <p className="text-neutral-300 mb-6 italic">
          You're turning into a freak of nature.
        </p>

        <button
          onClick={onClose}
          className="w-full bg-red-600 hover:bg-red-700 py-2 rounded-xl font-bold"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

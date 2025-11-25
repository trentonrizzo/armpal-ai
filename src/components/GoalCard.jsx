// src/components/GoalCard.jsx
import React from "react";

export default function GoalCard({ goal, onEdit, onDelete }) {
  const { title, current, target, deadline } = goal;

  const percent = target > 0 ? (current / target) * 100 : 0;
  const capped = Math.min(percent, 100);

  const overGoal = percent > 100;
  const extra = Math.max(0, current - target);

  return (
    <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl shadow-md mb-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-bold text-white">{title}</h3>

        {/* EDIT / DELETE */}
        <div className="flex gap-3 text-gray-400 text-sm">
          <button onClick={() => onEdit(goal)}>Edit</button>
          <button onClick={() => onDelete(goal.id)}>Delete</button>
        </div>
      </div>

      {/* Deadline */}
      {deadline && (
        <div className="text-xs text-red-400 mb-2">
          Deadline: {new Date(deadline).toLocaleDateString()}
        </div>
      )}

      {/* Percent */}
      <div className="text-sm mb-1">
        Progress:{" "}
        <span className="font-semibold text-red-500">
          {percent.toFixed(1)}%
        </span>
        {overGoal && (
          <span className="ml-2 text-green-400 font-semibold">
            +{extra} over goal
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={`h-full bg-red-600 transition-all ${
            overGoal ? "shadow-[0_0_10px_2px_rgba(255,0,0,0.6)]" : ""
          }`}
          style={{ width: `${capped}%` }}
        />
      </div>

      {/* Numbers */}
      <div className="text-xs text-gray-400 mt-2">
        {current} / {target}
      </div>
    </div>
  );
}

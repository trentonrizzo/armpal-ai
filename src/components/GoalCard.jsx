// src/components/GoalCard.jsx
import React from "react";

export default function GoalCard({ goal, onEdit, onDelete }) {

  // FIX: Use your real DB field names
  const current = goal.current_value || 0;
  const target = goal.target_value || 0;

  const progress = target > 0
    ? Math.min(100, Math.round((current / target) * 100))
    : 0;

  return (
    <div className="card mb-4 fade-in">

      {/* TITLE */}
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-white">{goal.title}</h2>

        <div className="flex gap-3 text-sm">
          <button
            onClick={() => onEdit(goal)}
            className="text-red-400 hover:text-red-300"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(goal.id)}
            className="text-gray-400 hover:text-red-500"
          >
            Delete
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="text-sm text-gray-400 mb-1">
        {current} / {target}
      </div>

      {/* PROGRESS BAR */}
      <div className="goal-progress-bar mt-2">
        <div
          className="goal-progress-fill progress-glow"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <div className="text-right text-xs text-gray-500 mt-1">
        {progress}% complete
      </div>

      {goal.deadline && (
        <div className="text-xs text-gray-500 mt-2">
          Deadline: {goal.deadline}
        </div>
      )}
    </div>
  );
}

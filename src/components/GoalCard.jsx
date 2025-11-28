// src/components/GoalCard.jsx
import React, { useEffect, useState } from "react";
import { FaBullseye, FaWeightHanging, FaDumbbell } from "react-icons/fa";

export default function GoalCard({ goal, onEdit, onDelete }) {
  // DB Field mapping (your schema)
  const current = goal.current_value || 0;
  const target = goal.target_value || 0;
  const rawProgress = target > 0 ? (current / target) * 100 : 0;
  const progress = Math.min(100, Math.round(rawProgress));

  // Smooth animated counter
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = progress;
    const duration = 600; // ms
    const increment = 15;

    const interval = setInterval(() => {
      start += (end / (duration / increment));
      if (start >= end) {
        start = end;
        clearInterval(interval);
      }
      setAnimatedProgress(Math.round(start));
    }, increment);

    return () => clearInterval(interval);
  }, [progress]);

  // Pick an icon based on goal.type
  const icon =
    goal.type === "pr" ? <FaDumbbell className="text-red-500" /> :
    goal.type === "measurement" ? <FaWeightHanging className="text-red-500" /> :
    <FaBullseye className="text-red-500" />;

  return (
    <div className="card mb-6 fade-in">

      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-3">
          {icon}
          <h2 className="text-xl font-bold text-white">{goal.title}</h2>
        </div>

        <div className="flex gap-3 text-sm">
          <button
            onClick={() => onEdit(goal)}
            className="px-3 py-1 rounded-lg bg-neutral-800 text-red-400 border border-neutral-700 hover:bg-neutral-700"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(goal.id)}
            className="px-3 py-1 rounded-lg bg-neutral-800 text-gray-400 border border-neutral-700 hover:bg-red-700 hover:text-white"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Numbers */}
      <div className="text-sm text-gray-300 mb-2">
        {current} / {target}
      </div>

      {/* Premium Gradient Progress Bar */}
      <div className="premium-progress-bar">
        <div
          className="premium-progress-fill"
          style={{
            width: `${animatedProgress}%`,
          }}
        ></div>
      </div>

      {/* Percentage */}
      <div className="text-right text-sm text-gray-400 mt-1">
        {animatedProgress}% complete
      </div>

      {/* Deadline */}
      {goal.deadline && (
        <div className="text-xs text-gray-500 mt-2">
          Deadline: {goal.deadline}
        </div>
      )}
    </div>
  );
}

// src/components/GoalCard.jsx
import React from "react";

export default function GoalCard({ goal, onEdit, onDelete }) {
  const current = goal.current_value || 0;
  const target = goal.target_value || 0;

  // real calculated percent (can be over 100)
  const raw = target > 0 ? Math.round((current / target) * 100) : 0;
  const percent = raw; // keep real number
  const capped = Math.min(raw, 100); // bar width stops at 100%

  const isOver = percent > 100;

  return (
    <div className="card mb-5 fade-in">

      {/* TITLE + Buttons */}
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

      {/* CURRENT / TARGET */}
      <div className="text-sm text-gray-300 mb-1">
        {current} / {target}
      </div>

      {/* PROGRESS BAR */}
      <div
        className="goal-progress-bar mt-2 relative overflow-visible"
        style={{
          height: "14px",
          background: "#1a1a1a",
          borderRadius: "20px",
          border: "1px solid rgba(255,0,0,0.25)",
        }}
      >
        {/* MAIN FILL */}
        <div
          className={`goal-progress-fill transition-all ${
            isOver ? "over-goal-fill" : "progress-glow"
          }`}
          style={{
            width: `${capped}%`,
            height: "100%",
            borderRadius: "20px",
            background: isOver
              ? "linear-gradient(90deg, #ffdd55, #ffaa00)"
              : "var(--red-soft)",
          }}
        ></div>

        {/* GOLDEN OVERFLOW INDICATOR */}
        {isOver && (
          <div
            className="absolute top-1/2 -translate-y-1/2 overflow-indicator"
            style={{
              left: "100%",
              width: "34px",
              height: "14px",
              background:
                "linear-gradient(90deg, rgba(255,221,85,0.9), rgba(255,170,0,0.8))",
              boxShadow: "0 0 10px rgba(255,200,0,0.7)",
              borderRadius: "10px",
              marginLeft: "8px",
              animation: "pulseGlow 1.2s infinite ease-in-out",
            }}
          ></div>
        )}
      </div>

      {/* PERCENT TEXT */}
      <div className="text-right text-xs text-gray-400 mt-1 font-semibold">
        {percent}% complete
      </div>

      {/* DEADLINE */}
      {goal.deadline && (
        <div className="text-xs text-gray-600 mt-2">
          Deadline: {goal.deadline}
        </div>
      )}
    </div>
  );
}

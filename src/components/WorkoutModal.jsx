import React, { useState } from "react";
import "../flames.css";

export default function WorkoutModal({
  workout,
  onClose,
  onAddExercise,
  onDeleteExercise,
}) {
  const [note, setNote] = useState("");

  // MOVE EXERCISE UP
  const moveExerciseUp = (index) => {
    if (index === 0) return;
    const updated = [...workout.exercises];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    updateOrder(updated);
  };

  // MOVE EXERCISE DOWN
  const moveExerciseDown = (index) => {
    if (index === workout.exercises.length - 1) return;
    const updated = [...workout.exercises];
    [updated[index + 1], updated[index]] = [updated[index], updated[index + 1]];
    updateOrder(updated);
  };

  // TEMP update function (DB save coming later)
  const updateOrder = (updated) => {
    workout.exercises = updated;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container flame-bg animate-slide-up">

        {/* HEADER */}
        <div className="modal-header">
          <h1 className="modal-title">{workout.name}</h1>
          <button className="modal-close-btn" onClick={onClose}>✖</button>
        </div>

        {/* EXERCISES LIST */}
        <div className="modal-exercises">
          {workout.exercises?.length === 0 ? (
            <p className="empty-text">No exercises yet.</p>
          ) : (
            workout.exercises.map((ex, i) => (
              <div key={ex.id} className="exercise-card">

                {/* TITLE + DELETE */}
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="exercise-title">{ex.name}</h3>
                    <p className="exercise-stats">
                      {ex.sets} × {ex.reps} @ {ex.weight}
                    </p>
                  </div>

                  <button
                    className="exercise-delete"
                    onClick={() => onDeleteExercise(ex.id)}
                  >
                    ✖
                  </button>
                </div>

                {/* REORDER BUTTONS */}
                <div className="flex gap-3 mt-2">
                  <button className="reorder-btn" onClick={() => moveExerciseUp(i)}>
                    ▲
                  </button>
                  <button className="reorder-btn" onClick={() => moveExerciseDown(i)}>
                    ▼
                  </button>
                </div>

              </div>
            ))
          )}
        </div>

        {/* ADD EXERCISE */}
        <div className="modal-add">
          <input
            type="text"
            placeholder="New exercise..."
            className="modal-input"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onAddExercise(e.target.value);
                e.target.value = "";
              }
            }}
          />
        </div>

        {/* NOTES SECTION */}
        <div className="modal-notes">
          <textarea
            placeholder="Notes for this workout..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="modal-textarea"
          />
          <button className="modal-save-note-btn">
            Save Notes
          </button>
        </div>

      </div>
    </div>
  );
}

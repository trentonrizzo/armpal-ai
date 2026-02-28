import React from "react";
import { getDisplayText } from "../../utils/displayText";

export default function AIWorkoutPreviewOverlay({
  open,
  onClose,
  workout,
  onSave,
}) {
  if (!open || !workout) return null;

  return (
    <div className="overlay-backdrop">
      <div className="overlay-panel">
        {/* Header */}
        <div className="overlay-header">
          <h2>{workout.name || "AI Generated Workout"}</h2>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Notes */}
        {workout.notes && (
          <p className="workout-notes">{workout.notes}</p>
        )}

        {/* Exercises */}
        <div className="exercise-list">
          {workout.exercises?.map((exercise, idx) => (
            <div key={idx} className="exercise-card">
              <h3>
                {idx + 1}. {getDisplayText(exercise)}
              </h3>

              {exercise.notes && (
                <p className="exercise-notes">{exercise.notes}</p>
              )}

              <div className="sets">
                {exercise.sets?.map((set, sIdx) => (
                  <div key={sIdx} className="set-row">
                    <span>Set {set.set_number ?? sIdx + 1}</span>
                    {set.weight != null && (
                      <span>{set.weight} lb</span>
                    )}
                    {set.reps != null && (
                      <span>{set.reps} reps</span>
                    )}
                    {set.duration_seconds != null && (
                      <span>{set.duration_seconds}s</span>
                    )}
                    {set.rpe != null && (
                      <span>RPE {set.rpe}</span>
                    )}
                    {set.is_warmup && (
                      <span className="warmup-tag">Warm-up</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="overlay-actions">
          <button className="secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary-btn"
            onClick={() => onSave(workout)}
          >
            Save Workout
          </button>
        </div>
      </div>
    </div>
  );
}

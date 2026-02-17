import React from "react";
import { useNavigate } from "react-router-dom";

export default function ProgramPreviewModal({ program, owned, onClose }) {
  const navigate = useNavigate();
  const meta = program?.parsed_program?.meta;
  const layouts = program?.parsed_program?.layouts ?? {};
  const firstFreq = Array.isArray(program?.parsed_program?.frequency_range) && program.parsed_program.frequency_range[0];
  const firstLayout = firstFreq != null ? layouts[String(firstFreq)] : null;
  const firstDay = firstLayout?.days?.[0] ?? firstLayout?.workouts?.[0];

  if (!program) return null;

  function handleInstall() {
    onClose();
    navigate(`/programs/${program.id}`);
  }

  function handleViewFull() {
    onClose();
    navigate(`/programs/${program.id}`);
  }

  return (
    <div className="program-preview-modal-backdrop" onClick={onClose}>
      <div className="program-preview-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="program-preview-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 className="program-preview-modal-title">{program.title}</h2>
        <div className="program-preview-modal-badges">
          {program.creator_id && <span className="badge creator-pro">Creator Program</span>}
          {meta?.difficulty && <span className="badge difficulty">{meta.difficulty}</span>}
          {owned && <span className="badge owned">Owned</span>}
        </div>
        {meta?.tags?.length > 0 && (
          <div className="program-preview-modal-tags">
            {meta.tags.map((tag) => (
              <span key={tag} className="badge tag">{tag}</span>
            ))}
          </div>
        )}
        <p className="program-preview-modal-desc">
          {program.preview_description || meta?.description || "No description."}
        </p>
        {firstDay && (
          <div className="program-preview-modal-preview">
            <h4>Preview: {firstDay.name}</h4>
            {firstDay.exercises?.slice(0, 5).map((ex, i) => (
              <div key={i} className="program-preview-modal-exercise">
                {ex.name} — {ex.sets} × {ex.reps}
                {ex.intensity ? ` @ ${ex.intensity}` : ""}
              </div>
            ))}
            {firstDay.exercises?.length > 5 && (
              <p className="program-preview-modal-more">+{firstDay.exercises.length - 5} more</p>
            )}
          </div>
        )}
        <div className="program-preview-modal-actions">
          <button type="button" className="program-preview-modal-btn primary" onClick={handleInstall}>
            Install Program
          </button>
          <button type="button" className="program-preview-modal-btn secondary" onClick={handleViewFull}>
            View Full Details
          </button>
        </div>
      </div>
    </div>
  );
}

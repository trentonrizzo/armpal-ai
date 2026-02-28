/**
 * Universal format preservation: canonical exercise display text.
 * Rule: "What is sent/generated = what is saved = what is displayed."
 * All UI must render getDisplayText(exercise) only (with this fallback when display_text is null).
 */

/**
 * Build a single display line from structured fields (fallback when display_text is missing).
 * Used for backfill, manual entry, and legacy data.
 */
export function buildDisplayText(ex) {
  if (!ex) return "";
  const name = ex.name ?? ex.exercise ?? ex.title ?? "";
  const parts = [name.trim()];
  if (ex.sets != null && ex.reps != null) {
    parts.push(` — ${ex.sets}x${ex.reps}`);
  } else if (ex.sets != null) {
    parts.push(` — ${ex.sets} sets`);
  } else if (ex.reps != null) {
    parts.push(` — ${ex.reps} reps`);
  }
  if (ex.percentage) parts.push(` — ${ex.percentage}`);
  if (ex.rpe) parts.push(` @ RPE ${ex.rpe}`);
  if (ex.weight != null && ex.weight !== "" && typeof ex.weight === "string" && !ex.weight.trim().startsWith("{")) {
    parts.push(` (~${ex.weight} lbs)`);
  } else if (ex.weight != null && ex.weight !== "" && typeof ex.weight !== "object") {
    parts.push(` — ${ex.weight}`);
  }
  if (ex.notes) parts.push(` (${ex.notes})`);
  return parts.join("").trim() || "Exercise";
}

/**
 * Canonical display string for an exercise. Use this everywhere in UI.
 * Prefer stored display_text; otherwise build from name/sets/reps/percentage/weight/notes.
 */
export function getDisplayText(exercise) {
  if (!exercise) return "";
  const text = exercise.display_text ?? null;
  if (text != null && String(text).trim() !== "") return String(text).trim();
  return buildDisplayText(exercise);
}

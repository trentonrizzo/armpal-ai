import { getDisplayText } from "./displayText";

/**
 * Normalize a single exercise into a share-safe shape.
 * Works for:
 * - structured { name, sets, reps, weight }
 * - flexible { name, input }
 * - shapes that already have display_text
 */
export function normalizeExerciseForShare(ex, index = 0) {
  if (!ex || typeof ex !== "object") {
    const display_text = getDisplayText(null);
    return {
      name: "Exercise",
      sets: null,
      reps: null,
      weight: null,
      input: null,
      display_text,
      position: index,
    };
  }

  const name = String(
    ex.name ?? ex.exercise ?? ex.title ?? "Exercise"
  ).trim();

  const sets =
    ex.sets === "" || ex.sets === undefined ? null : ex.sets;
  const reps =
    ex.reps === "" || ex.reps === undefined ? null : ex.reps;
  const weight =
    ex.weight === "" || ex.weight === undefined ? null : ex.weight;
  const input =
    ex.input === "" || ex.input === undefined ? null : ex.input ?? null;

  let display_text = "";
  if (ex.display_text != null && String(ex.display_text).trim() !== "") {
    display_text = String(ex.display_text).trim();
  } else {
    display_text = getDisplayText({
      name,
      sets,
      reps,
      weight,
      input,
    });
  }

  const out = {
    name,
    sets,
    reps,
    weight,
    input,
    display_text,
  };

  if (ex.position != null) {
    out.position = ex.position;
  } else {
    out.position = index;
  }

  return out;
}

/**
 * Normalize a workout into a share-safe shape, using its current exercises array.
 */
export function normalizeWorkoutForShare(workout) {
  if (!workout || typeof workout !== "object") {
    return {
      id: null,
      name: "Workout",
      scheduled_for: null,
      exercises: [],
    };
  }

  const exercisesArray = Array.isArray(workout.exercises)
    ? workout.exercises
    : [];

  const normalizedExercises = exercisesArray.map((ex, idx) =>
    normalizeExerciseForShare(ex, idx)
  );

  return {
    id: workout.id ?? null,
    name: workout.name ?? "Workout",
    scheduled_for: workout.scheduled_for ?? null,
    exercises: normalizedExercises,
  };
}


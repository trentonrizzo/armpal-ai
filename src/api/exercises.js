import { supabase } from "../supabaseClient";

// Add an exercise to a workout. Pass display_text to preserve exact format (universal save rule).
export async function addExercise({ userId, workoutId, name, sets, reps, weight, display_text }) {
  const { data, error } = await supabase
    .from("exercises")
    .insert([
      {
        user_id: userId,
        workout_id: workoutId,
        name,
        sets: sets ? Number(sets) : null,
        reps: reps ? Number(reps) : null,
        weight: weight ?? "",
        display_text: display_text ?? null,
      },
    ])
    .select();

  if (error) {
    console.error("Error inserting exercise:", error);
    return null;
  }

  return data[0];
}

// Update an exercise (e.g. rename or tweak fields)
export async function updateExercise(id, fields) {
  const { error } = await supabase
    .from("exercises")
    .update(fields)
    .eq("id", id);

  if (error) {
    console.error("Error updating exercise:", error);
  }
}

// Delete an exercise
export async function deleteExercise(id) {
  const { error } = await supabase
    .from("exercises")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting exercise:", error);
  }
}

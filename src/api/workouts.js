import { supabase } from "../supabaseClient";
import { safeStripWorkoutReminderAfterDelete } from "../services/workoutLocalNotifications";

// Get workouts + exercises for user
export async function getWorkoutsWithExercises(userId) {
  const { data: workouts, error: wError } = await supabase
    .from("workouts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (wError) {
    console.error("Workouts fetch error:", wError);
    return [];
  }

  const { data: exercises, error: eError } = await supabase
    .from("exercises")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (eError) {
    console.error("Exercises fetch error:", eError);
    return workouts.map((w) => ({ ...w, exercises: [] }));
  }

  return workouts.map((w) => ({
    ...w,
    exercises: exercises.filter((ex) => ex.workout_id === w.id),
  }));
}

// Add workout
export async function addWorkout({ userId, name }) {
  const { data, error } = await supabase
    .from("workouts")
    .insert([{ user_id: userId, name }])
    .select();

  if (error) {
    console.error("Workout insert error:", error);
    return null;
  }

  return data[0];
}

// Update workout
export async function updateWorkout(id, fields) {
  const { error } = await supabase
    .from("workouts")
    .update(fields)
    .eq("id", id);

  if (error) console.error("Workout update error:", error);
}

// Delete workout (Supabase). Optional userId strips local reminder prefs + native cancel.
export async function deleteWorkout(id, userId = null) {
  const { error } = await supabase.from("workouts").delete().eq("id", id);

  if (error) {
    console.error("Workout delete error:", error);
    return;
  }
  try {
    if (userId != null && id != null) {
      safeStripWorkoutReminderAfterDelete(userId, id);
    }
  } catch (e) {
    console.warn("[api/workouts] reminder strip after delete:", e?.message);
  }
}

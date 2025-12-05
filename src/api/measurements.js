import { supabase } from "../supabaseClient";

// Get all measurements for a user
export async function getMeasurements(userId) {
  const { data, error } = await supabase
    .from("measurements")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (error) {
    console.error("Error loading measurements:", error);
    return [];
  }
  return data || [];
}

// Add measurement
export async function addMeasurement(measurement) {
  const { data, error } = await supabase.from("measurements").insert({
    user_id: measurement.userId,
    name: measurement.name,
    value: measurement.value,
    unit: measurement.unit,
    date: measurement.date,
  });

  if (error) {
    console.error("Error adding measurement:", error);
    return null;
  }
  return data;
}

// Update measurement (NEW)
export async function updateMeasurement(id, updates) {
  const { data, error } = await supabase
    .from("measurements")
    .update({
      name: updates.name,
      value: updates.value,
      unit: updates.unit,
      date: updates.date,
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating measurement:", error);
    return null;
  }
  return data;
}

// Delete measurement
export async function deleteMeasurement(id) {
  const { data, error } = await supabase
    .from("measurements")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting measurement:", error);
    return null;
  }
  return data;
}

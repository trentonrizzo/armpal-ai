import { supabase } from "../supabaseClient";

// Fetch measurements for the user
export async function getMeasurements(userId) {
  const { data, error } = await supabase
    .from("measurements")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching measurements:", error);
    return [];
  }

  return data;
}

// Add a new measurement
export async function addMeasurement({ userId, name, value, unit, date }) {
  const { data, error } = await supabase
    .from("measurements")
    .insert([
      {
        user_id: userId,
        name,
        value: Number(value),
        unit,
        date,
      },
    ])
    .select();

  if (error) {
    console.error("Error inserting measurement:", error);
    return null;
  }

  return data[0];
}

// Delete a measurement
export async function deleteMeasurement(id) {
  const { error } = await supabase
    .from("measurements")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting measurement:", error);
  }
}

import { supabase } from "../supabaseClient";

// GET all measurements for the user
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

// ADD a measurement entry
export async function addMeasurement(entry) {
  const { data, error } = await supabase
    .from("measurements")
    .insert([entry])
    .select();

  if (error) {
    console.error("Error inserting measurement:", error);
    return null;
  }

  return data[0];
}

// DELETE a measurement entry
export async function deleteMeasurement(id) {
  const { error } = await supabase
    .from("measurements")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting measurement:", error);
  }
}

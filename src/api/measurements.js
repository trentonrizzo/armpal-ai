import { supabase } from "../supabaseClient";

// ----------------------------------------------------------
// GET user measurements
// ----------------------------------------------------------
export async function getMeasurements(userId) {
  const { data, error } = await supabase
    .from("measurements")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (error) {
    console.error("getMeasurements error:", error);
    return [];
  }

  return data;
}

// ----------------------------------------------------------
// ADD new measurement
// ----------------------------------------------------------
export async function addMeasurement({ userId, name, value, unit, date }) {
  const { data, error } = await supabase
    .from("measurements")
    .insert([
      {
        user_id: userId,
        name,
        value,
        unit,
        date,
      },
    ])
    .select();

  if (error) {
    console.error("addMeasurement error:", error);
    return null;
  }

  return data;
}

// ----------------------------------------------------------
// UPDATE existing measurement (your new need!)
// ----------------------------------------------------------
export async function updateMeasurement({ id, name, value, unit, date }) {
  const { data, error } = await supabase
    .from("measurements")
    .update({ name, value, unit, date })
    .eq("id", id)
    .select();

  if (error) {
    console.error("updateMeasurement error:", error);
    return null;
  }

  return data;
}

// ----------------------------------------------------------
// DELETE measurement
// ----------------------------------------------------------
export async function deleteMeasurement(id) {
  const { error } = await supabase
    .from("measurements")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("deleteMeasurement error:", error);
    return false;
  }

  return true;
}

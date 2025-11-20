import { supabase } from "../supabaseClient";

// Fetch PRs for the logged-in user
export async function getPRs(userId) {
  const { data, error } = await supabase
    .from("PRs")
    .select("*")
    .eq("user_id", userId)
    .order("id", { ascending: false }); // ✅ use id, NOT created_at

  if (error) {
    console.error("Error fetching PRs:", error);
    return [];
  }

  return data;
}

// Add a new PR
export async function addPR({ userId, lift_name, weight, unit, date }) {
  const { data, error } = await supabase
    .from("PRs")
    .insert([
      {
        user_id: userId,
        lift_name,
        weight,
        unit,
        date,
      },
    ])
    .select();

  if (error) {
    console.error("Error inserting PR:", error);
    return null;
  }

  return data[0];
}

// Delete a PR
export async function deletePR(id) {
  const { error } = await supabase
    .from("PRs")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting PR:", error);
  }
}

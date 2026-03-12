// src/api/prs.js
import { supabase } from "../supabaseClient";

// ----------------------------
// GET ALL PRs (sorted properly)
// ----------------------------
export async function getPRs(userId) {
  const { data, error } = await supabase
    .from("prs")
    .select("*")
    .eq("user_id", userId)
    .order("order_index", { ascending: true })
    .order("date", { ascending: false });

  if (error) {
    console.error("getPRs error:", error);
    return [];
  }

  return data || [];
}

// ----------------------------
// ADD PR
// ----------------------------
export async function addPR({ userId, lift_name, weight, unit, date }) {
  const { data: maxOrder } = await supabase
    .from("prs")
    .select("order_index")
    .eq("user_id", userId)
    .order("order_index", { ascending: false })
    .limit(1);

  const nextIndex = maxOrder?.[0]?.order_index + 1 || 0;

  const { data, error } = await supabase
    .from("prs")
    .insert([
      {
        user_id: userId,
        lift_name,
        weight,
        unit,
        date,
        order_index: nextIndex
      }
    ])
    .select();

  if (error) console.error("addPR error:", error);

  return data?.[0];
}

// ----------------------------
// DELETE PR
// ----------------------------
export async function deletePR(id) {
  const { error } = await supabase.from("prs").delete().eq("id", id);
  if (error) console.error("deletePR error:", error);
}

// ----------------------------
// UPDATE PR (edit button)
// ----------------------------
export async function updatePR(id, values) {
  const { data, error } = await supabase
    .from("prs")
    .update(values)
    .eq("id", id)
    .select();

  if (error) {
    console.error("updatePR error:", error);
    return null;
  }

  return data?.[0];
}

// ---------------------------------------
// BULK UPDATE order_index (drag + drop)
// ---------------------------------------
export async function updatePROrder(updates) {
  const { error } = await supabase
    .from("prs")
    .upsert(updates, { onConflict: "id" });

  if (error) console.error("updatePROrder error:", error);
}

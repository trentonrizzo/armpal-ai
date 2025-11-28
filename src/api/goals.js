// src/api/goals.js
import { supabase } from "../supabaseClient";

// ---------- CREATE ----------
export async function createGoal(goal) {
  const { data, error } = await supabase
    .from("goals")
    .insert([goal])
    .select();

  if (error) {
    console.error("Error creating goal:", error);
    return null;
  }

  return data?.[0];
}

// ---------- READ ----------
export async function getGoals(userId) {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) console.error("Error loading goals:", error);
  return data || [];
}

// ---------- UPDATE ----------
export async function updateGoal(id, updates) {
  const { data, error } = await supabase
    .from("goals")
    .update(updates)
    .eq("id", id)
    .select();

  if (error) {
    console.error("Error updating goal:", error);
    return null;
  }

  return data?.[0];
}

// ---------- DELETE ----------
export async function deleteGoal(id) {
  const { error } = await supabase
    .from("goals")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting goal:", error);
    return false;
  }

  return true;
}

/**
 * Nutrition tracker — Supabase CRUD and daily totals.
 * Structured for future AI coach: weekly averages, protein trends, streak tracking.
 */
import { supabase } from "../../supabaseClient";

/**
 * @param {string} userId
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<Array<{ id, user_id, date, food_name, calories, protein, carbs, fat, notes, created_at, updated_at }>>}
 */
export async function fetchEntriesByDate(userId, date) {
  if (!userId || !date) return [];
  const { data, error } = await supabase
    .from("nutrition_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * @param {string} userId
 * @param {string} fromDate - YYYY-MM-DD
 * @param {string} toDate - YYYY-MM-DD
 * @returns {Promise<Array>}
 */
export async function fetchEntriesRange(userId, fromDate, toDate) {
  if (!userId || !fromDate || !toDate) return [];
  const { data, error } = await supabase
    .from("nutrition_entries")
    .select("*")
    .eq("user_id", userId)
    .gte("date", fromDate)
    .lte("date", toDate)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * @param {{ user_id: string, date: string, food_name?: string, calories?: number, protein?: number, carbs?: number, fat?: number, notes?: string }} data
 * @returns {Promise<object>}
 */
export async function addEntry(data) {
  const row = {
    user_id: data.user_id,
    date: data.date,
    food_name: data.food_name ?? null,
    calories: Number(data.calories) || 0,
    protein: Number(data.protein) || 0,
    carbs: Number(data.carbs) || 0,
    fat: Number(data.fat) || 0,
    notes: data.notes ?? null,
  };
  const { data: inserted, error } = await supabase
    .from("nutrition_entries")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return inserted;
}

/**
 * @param {string} id
 * @param {{ food_name?: string, calories?: number, protein?: number, carbs?: number, fat?: number, notes?: string }} data
 * @returns {Promise<object>}
 */
export async function updateEntry(id, data) {
  const updates = {};
  if (data.food_name !== undefined) updates.food_name = data.food_name;
  if (data.calories !== undefined) updates.calories = Number(data.calories) || 0;
  if (data.protein !== undefined) updates.protein = Number(data.protein) || 0;
  if (data.carbs !== undefined) updates.carbs = Number(data.carbs) || 0;
  if (data.fat !== undefined) updates.fat = Number(data.fat) || 0;
  if (data.notes !== undefined) updates.notes = data.notes;
  const { data: updated, error } = await supabase
    .from("nutrition_entries")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return updated;
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteEntry(id) {
  const { error } = await supabase.from("nutrition_entries").delete().eq("id", id);
  if (error) throw error;
}

/**
 * @param {Array<{ calories?: number, protein?: number, carbs?: number, fat?: number }>} entries
 * @returns {{ calories: number, protein: number, carbs: number, fat: number }}
 */
export function calculateDailyTotals(entries) {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  if (!Array.isArray(entries)) return totals;
  for (const e of entries) {
    totals.calories += Number(e.calories) || 0;
    totals.protein += Number(e.protein) || 0;
    totals.carbs += Number(e.carbs) || 0;
    totals.fat += Number(e.fat) || 0;
  }
  return totals;
}

/**
 * For future AI coach: weekly calories and protein averages.
 * @param {string} userId
 * @param {string} endDate - YYYY-MM-DD
 * @param {number} days - e.g. 7
 * @returns {Promise<{ avgCalories: number, avgProtein: number, daysWithData: number }>}
 */
export async function getWeeklyAverages(userId, endDate, days = 7) {
  const d = new Date(endDate + "T12:00:00Z");
  const start = new Date(d);
  start.setDate(start.getDate() - days + 1);
  const fromDate = start.toISOString().slice(0, 10);
  const entries = await fetchEntriesRange(userId, fromDate, endDate);
  const byDay = {};
  for (const e of entries) {
    if (!byDay[e.date]) byDay[e.date] = [];
    byDay[e.date].push(e);
  }
  let totalCal = 0, totalPro = 0, count = 0;
  for (const date of Object.keys(byDay)) {
    const t = calculateDailyTotals(byDay[date]);
    totalCal += t.calories;
    totalPro += t.protein;
    count += 1;
  }
  return {
    avgCalories: count ? Math.round(totalCal / count) : 0,
    avgProtein: count ? Math.round(totalPro / count) : 0,
    daysWithData: count,
  };
}

/*
  usageCaps.js — Single source of truth for free vs pro limits.
  Reads is_pro from Supabase profiles; caps workouts, PRs, measurements,
  bodyweight logs, and goals. Free: 5 each. Pro: 1000 each.
  Import and call checkUsageCap(userId, type) before creating an entry.
*/

import { supabase } from "../supabaseClient";

export const FREE_CAP = 5;
export const PRO_CAP = 1000;

/** @type {Record<string, string>} table name by usage type */
const TABLE_BY_TYPE = {
  workouts: "workouts",
  prs: "prs",
  measurements: "measurements",
  bodyweight: "bodyweight_logs",
  goals: "goals",
};

/**
 * Get whether the user has Pro (from Supabase profiles.is_pro).
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function getIsPro(userId) {
  if (!userId) return false;
  const { data, error } = await supabase
    .from("profiles")
    .select("is_pro")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("usageCaps getIsPro:", error);
    return false;
  }
  return data?.is_pro === true;
}

/**
 * Check if the user can add one more entry of the given type.
 * Fetches is_pro from profiles and current count from the relevant table.
 * @param {string} userId
 * @param {'workouts'|'prs'|'measurements'|'bodyweight'|'goals'} type
 * @returns {Promise<{ allowed: boolean, limit: number, currentCount: number, isPro: boolean }>}
 */
export async function checkUsageCap(userId, type) {
  const limit = await getIsPro(userId).then((isPro) =>
    isPro ? PRO_CAP : FREE_CAP
  );
  const isPro = limit === PRO_CAP;
  const table = TABLE_BY_TYPE[type];
  if (!table) {
    return { allowed: false, limit: 0, currentCount: 0, isPro };
  }

  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    console.error("usageCaps count error:", type, error);
    return { allowed: false, limit, currentCount: 0, isPro };
  }

  const currentCount = count ?? 0;
  const allowed = currentCount < limit;
  return { allowed, limit, currentCount, isPro };
}

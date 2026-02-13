/*
  usageLimits.js — SINGLE SOURCE OF TRUTH for Pro/free limits.
  Pro status comes ONLY from Supabase profiles.is_pro (never hard-coded).
  All limit enforcement (workouts, PRs, measurements, bodyweight, goals) must
  call checkUsageCap(userId, type) at action/save level.
*/

import { supabase } from "../supabaseClient";

export const FREE_CAP = 5;
export const PRO_CAP = 1000;

const TABLE_BY_TYPE = {
  workouts: "workouts",
  prs: "prs",
  measurements: "measurements",
  bodyweight: "bodyweight_logs",
  goals: "goals",
};

/**
 * Get Pro status from Supabase profiles only. No hard-coding.
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
    console.error("usageLimits getIsPro:", error);
    return false;
  }
  return data?.is_pro === true;
}

/**
 * Check if user can add one more entry. Uses profiles.is_pro and DB count only.
 * @param {string} userId
 * @param {'workouts'|'prs'|'measurements'|'bodyweight'|'goals'} type
 * @returns {Promise<{ allowed: boolean, limit: number, currentCount: number, isPro: boolean }>}
 */
export async function checkUsageCap(userId, type) {
  const isPro = await getIsPro(userId);
  const limit = isPro ? PRO_CAP : FREE_CAP;
  const table = TABLE_BY_TYPE[type];
  if (!table) {
    return { allowed: false, limit: 0, currentCount: 0, isPro: false };
  }

  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    console.error("usageLimits count error:", type, error);
    return { allowed: false, limit, currentCount: 0, isPro };
  }

  const currentCount = count ?? 0;
  const allowed = currentCount < limit;
  return { allowed, limit, currentCount, isPro };
}

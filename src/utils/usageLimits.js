/*
  usageLimits.js — SINGLE SOURCE OF TRUTH for entry caps.

  As of the live App Store build, the artificial 5-item free-tier ceiling on
  workouts / PRs / measurements / bodyweight / goals has been removed.
  `checkUsageCap` keeps its return shape so every consumer continues to work
  unchanged, but `allowed` is now always true and `limit` is unbounded.

  Pro status is still read from Supabase `profiles.is_pro` and surfaced via
  `getIsPro` so any non-UI code that still cares about it keeps working —
  but no client-side gating decision depends on it anymore.
*/

import { supabase } from "../supabaseClient";

// Unbounded caps — kept exported so legacy imports (Workouts.jsx / Trackers.jsx
// and any other consumer reading these constants directly) continue to work.
export const FREE_CAP = Number.POSITIVE_INFINITY;
export const PRO_CAP = Number.POSITIVE_INFINITY;

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
 * Check if user can add one more entry.
 *
 * Caps are now unbounded — this function always returns `allowed: true` and
 * an `Infinity` limit. The current row count is still reported (best-effort)
 * so UIs that surface "X of Y" can still render a count if they wish, but no
 * client-side gating decision is made against the limit anymore.
 *
 * The return shape is preserved exactly so every existing call site continues
 * to work without modification.
 *
 * @param {string} userId
 * @param {'workouts'|'prs'|'measurements'|'bodyweight'|'goals'} type
 * @returns {Promise<{ allowed: boolean, limit: number, currentCount: number, isPro: boolean }>}
 */
export async function checkUsageCap(userId, type) {
  const isPro = await getIsPro(userId);
  const limit = Number.POSITIVE_INFINITY;

  // Even with caps removed, fetch the real count so callers that show usage
  // (e.g. "you have N workouts saved") keep displaying accurate numbers.
  // If the count can't be read, we still allow the action — never block.
  const table = TABLE_BY_TYPE[type];
  let currentCount = 0;
  if (table && userId) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    if (error) {
      console.error("usageLimits count error:", type, error);
    } else {
      currentCount = count ?? 0;
    }
  }

  return { allowed: true, limit, currentCount, isPro };
}

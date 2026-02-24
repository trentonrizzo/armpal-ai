/**
 * Flappy Arm — score submit and leaderboard.
 * - arcade_flappy_arm_scores (table): we only INSERT here. Never write to arcade_flappy_arm_leaderboard (view).
 * - arcade_flappy_arm_leaderboard: SELECT only, for display; updates via trigger from scores.
 */
import { supabase } from "../../supabaseClient";

/**
 * Fetch current user's best score from arcade_flappy_arm_scores (max score).
 * @returns {{ best_score: number | null }}
 */
export async function getFlappyBestForUser(userId) {
  if (!userId) return { best_score: null };
  try {
    const { data, error } = await supabase
      .from("arcade_flappy_arm_scores")
      .select("score")
      .eq("user_id", userId)
      .order("score", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[FlappyArm] getFlappyBestForUser error:", error);
      return { best_score: null };
    }
    const best = data?.score != null ? Number(data.score) : null;
    return { best_score: best };
  } catch (e) {
    console.error("[FlappyArm] getFlappyBestForUser:", e);
    return { best_score: null };
  }
}

/**
 * Submit score on game over. Inserts into arcade_flappy_arm_scores only (never leaderboard view).
 * 1) Read current best from arcade_flappy_arm_scores.
 * 2) is_pr = (score > best || best is null).
 * 3) Insert { user_id, score, is_pr } into arcade_flappy_arm_scores.
 * 4) Returns { newRecord, newBest } for UI.
 */
export async function submitFlappyScore(userId, currentScore) {
  const score = typeof currentScore === "number" ? currentScore : 0;
  const out = { newRecord: false, newBest: score };

  if (!userId) return out;

  try {
    const { data: bestRow } = await supabase
      .from("arcade_flappy_arm_scores")
      .select("score")
      .eq("user_id", userId)
      .order("score", { ascending: false })
      .limit(1)
      .maybeSingle();
    const best = bestRow?.score != null ? Number(bestRow.score) : null;
    const is_pr = best === null || score > best;

    const { error: insertError } = await supabase
      .from("arcade_flappy_arm_scores")
      .insert({ user_id: userId, score, is_pr });

    if (insertError) {
      console.error("[FlappyArm] arcade_flappy_arm_scores insert error:", insertError);
      return out;
    }
    out.newRecord = is_pr;
    out.newBest = is_pr ? score : (best ?? score);
  } catch (e) {
    console.error("[FlappyArm] submitFlappyScore:", e);
  }
  return out;
}

/**
 * Refetch leaderboard list (e.g. after update). Returns rows from arcade_flappy_arm_leaderboard.
 */
export async function fetchFlappyLeaderboard(limit = 50) {
  try {
    const { data, error } = await supabase
      .from("arcade_flappy_arm_leaderboard")
      .select("user_id, best_score, total_games")
      .order("best_score", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[FlappyArm] fetchFlappyLeaderboard error:", error);
      return [];
    }
    return data ?? [];
  } catch (e) {
    console.error("[FlappyArm] fetchFlappyLeaderboard:", e);
    return [];
  }
}

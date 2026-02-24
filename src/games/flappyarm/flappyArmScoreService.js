/**
 * Flappy Arm — score submit and leaderboard using existing tables:
 * - arcade_flappy_arm_scores (all runs)
 * - arcade_flappy_arm_leaderboard (best score per user)
 */
import { supabase } from "../../supabaseClient";

/**
 * Fetch current user's best score from leaderboard table.
 * @returns {{ best_score: number | null }}
 */
export async function getFlappyBestForUser(userId) {
  if (!userId) return { best_score: null };
  try {
    const { data, error } = await supabase
      .from("arcade_flappy_arm_leaderboard")
      .select("best_score")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("[FlappyArm] getFlappyBestForUser error:", error);
      return { best_score: null };
    }
    const best = data?.best_score != null ? Number(data.best_score) : null;
    return { best_score: best };
  } catch (e) {
    console.error("[FlappyArm] getFlappyBestForUser:", e);
    return { best_score: null };
  }
}

/**
 * Submit score on game over. Uses arcade_flappy_arm_scores and arcade_flappy_arm_leaderboard only.
 * 1) Insert run into arcade_flappy_arm_scores.
 * 2) Fetch leaderboard row for user.
 * 3) If no row: insert into arcade_flappy_arm_leaderboard (user_id, best_score, achieved_at), newRecord = true.
 * 4) If row exists: if currentScore > best_score then update leaderboard; newRecord = true. Else newRecord = false.
 * 5) Returns { newRecord, newBest } for UI.
 */
export async function submitFlappyScore(userId, currentScore) {
  const score = typeof currentScore === "number" ? currentScore : 0;
  const out = { newRecord: false, newBest: score };

  if (!userId) return out;

  const now = new Date().toISOString();

  try {
    // 1) Insert run into arcade_flappy_arm_scores
    const { error: insertScoreError } = await supabase
      .from("arcade_flappy_arm_scores")
      .insert({ user_id: userId, score, achieved_at: now });

    if (insertScoreError) {
      console.error("[FlappyArm] arcade_flappy_arm_scores insert error:", insertScoreError);
      return out;
    }

    // 2) Fetch leaderboard row
    const { data: leaderboardRow, error: fetchError } = await supabase
      .from("arcade_flappy_arm_leaderboard")
      .select("best_score")
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) {
      console.error("[FlappyArm] arcade_flappy_arm_leaderboard fetch error:", fetchError);
      return out;
    }

    const storedBest = leaderboardRow?.best_score != null ? Number(leaderboardRow.best_score) : null;

    // 3) No row → insert; 4) Row exists → update only if currentScore > best_score
    if (leaderboardRow == null) {
      const { error: insertLeaderboardError } = await supabase
        .from("arcade_flappy_arm_scores")
        .insert({
          user_id: userId,
          best_score: score,
          achieved_at: now,
        });

      if (insertLeaderboardError) {
        console.error("[FlappyArm] arcade_flappy_arm_leaderboard insert error:", insertLeaderboardError);
        return out;
      }
      out.newRecord = true;
      out.newBest = score;
    } else {
      if (score > storedBest) {
        const { error: updateError } = await supabase
          .from("arcade_flappy_arm_leaderboard")
          .update({ best_score: score, achieved_at: now })
          .eq("user_id", userId);

        if (updateError) {
          console.error("[FlappyArm] arcade_flappy_arm_leaderboard update error:", updateError);
          return out;
        }
        out.newRecord = true;
        out.newBest = score;
      } else {
        out.newRecord = false;
        out.newBest = storedBest;
      }
    }
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
      .select("user_id, best_score, achieved_at")
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

import { supabase } from "../../../supabaseClient";

/**
 * Update global game_user_stats at game end. No game logic — call only when game ends.
 * @param {Object} opts
 * @param {string} opts.userId - auth user id
 * @param {string} opts.gameType - e.g. 'flappy_arm', 'reaction_speed', 'tictactoe'
 * @param {number} [opts.score] - current score (higher = better for flappy; used for best_score)
 * @param {boolean} [opts.isWin] - true if player won (TTT)
 * @param {boolean} [opts.isLoss] - true if player lost (TTT)
 * @param {number} [opts.reactionTime] - ms (lower = better; stored in fastest_time)
 * @returns {Promise<{ newPersonalRecord: boolean }>}
 */
export async function updateGameStats({ userId, gameType, score, isWin, isLoss, reactionTime }) {
  if (!userId || !gameType) return { newPersonalRecord: false };

  const { data: row } = await supabase
    .from("game_user_stats")
    .select("*")
    .eq("user_id", userId)
    .eq("game_type", gameType)
    .maybeSingle();

  const prev = row || {};
  let newPersonalRecord = false;

  const updates = {
    user_id: userId,
    game_type: gameType,
    total_games: (prev.total_games ?? 0) + 1,
    best_score: prev.best_score ?? 0,
    wins: prev.wins ?? 0,
    losses: prev.losses ?? 0,
    win_streak: prev.win_streak ?? 0,
    best_streak: prev.best_streak ?? 0,
    fastest_time: prev.fastest_time ?? null,
    updated_at: new Date().toISOString(),
  };

  if (score != null && typeof score === "number" && gameType === "flappy_arm") {
    if (score > (updates.best_score || 0)) {
      updates.best_score = score;
      newPersonalRecord = true;
    }
  }

  if (reactionTime != null && typeof reactionTime === "number") {
    const prevTime = updates.fastest_time != null ? Number(updates.fastest_time) : null;
    if (prevTime == null || reactionTime < prevTime) {
      updates.fastest_time = reactionTime;
      newPersonalRecord = true;
    }
  }

  if (isWin === true) {
    updates.wins = (updates.wins || 0) + 1;
    updates.win_streak = (updates.win_streak || 0) + 1;
    if ((updates.win_streak || 0) > (updates.best_streak || 0)) {
      updates.best_streak = updates.win_streak;
    }
  }

  if (isLoss === true) {
    updates.losses = (updates.losses || 0) + 1;
    updates.win_streak = 0;
  }

  await supabase
    .from("game_user_stats")
    .upsert(updates, { onConflict: "user_id,game_type" });

  return {
    newPersonalRecord,
    stats: {
      wins: updates.wins ?? 0,
      losses: updates.losses ?? 0,
      win_streak: updates.win_streak ?? 0,
      best_streak: updates.best_streak ?? 0,
    },
  };
}

-- One row per (user_id, game_id) for Flappy Arm leaderboard upsert
ALTER TABLE game_leaderboard
  ADD CONSTRAINT game_leaderboard_user_game_unique UNIQUE (user_id, game_id);

CREATE POLICY "Users can update own leaderboard row"
  ON game_leaderboard FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

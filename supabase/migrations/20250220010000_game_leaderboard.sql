-- Leaderboard entries: one row per score submission for public top-100 view (realtime)
CREATE TABLE IF NOT EXISTS game_leaderboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score numeric NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE game_leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read leaderboard"
  ON game_leaderboard FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own row"
  ON game_leaderboard FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_game_leaderboard_game_score ON game_leaderboard(game_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_game_leaderboard_created ON game_leaderboard(created_at);

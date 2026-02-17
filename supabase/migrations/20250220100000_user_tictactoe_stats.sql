-- Per-user Tic Tac Toe stats (not leaderboard)
CREATE TABLE IF NOT EXISTS user_tictactoe_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  wins int NOT NULL DEFAULT 0,
  losses int NOT NULL DEFAULT 0,
  draws int NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE user_tictactoe_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own ttt stats"
  ON user_tictactoe_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ttt stats"
  ON user_tictactoe_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ttt stats"
  ON user_tictactoe_stats FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- One best score per user per game (for Reaction: lower is better; for Flappy: higher is better)
CREATE TABLE IF NOT EXISTS user_game_best (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  best_score numeric NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, game_id)
);

ALTER TABLE user_game_best ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own best"
  ON user_game_best FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own best"
  ON user_game_best FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own best"
  ON user_game_best FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_game_best_user_game ON user_game_best(user_id, game_id);

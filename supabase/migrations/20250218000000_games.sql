-- Games catalog
CREATE TABLE IF NOT EXISTS games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  game_type text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Games are readable by everyone"
  ON games FOR SELECT
  USING (true);

-- User game scores
CREATE TABLE IF NOT EXISTS user_game_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  score numeric NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE user_game_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own scores"
  ON user_game_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scores"
  ON user_game_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_games_game_type ON games(game_type);
CREATE INDEX IF NOT EXISTS idx_user_game_scores_user_game ON user_game_scores(user_id, game_id);

-- Unified game stats per user per game type (arcade profile)
CREATE TABLE IF NOT EXISTS game_user_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_type text NOT NULL,
  best_score integer DEFAULT 0,
  total_games integer DEFAULT 0,
  wins integer DEFAULT 0,
  losses integer DEFAULT 0,
  win_streak integer DEFAULT 0,
  best_streak integer DEFAULT 0,
  fastest_time numeric DEFAULT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, game_type)
);

ALTER TABLE game_user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own game_user_stats"
  ON game_user_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own game_user_stats"
  ON game_user_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own game_user_stats"
  ON game_user_stats FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_game_user_stats_user ON game_user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_game_user_stats_game_type ON game_user_stats(game_type);

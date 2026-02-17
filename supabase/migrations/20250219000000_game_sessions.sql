-- Multiplayer game sessions (e.g. Tic Tac Toe)
CREATE TABLE IF NOT EXISTS game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_one uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_two uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_turn uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  state jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  winner uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  chat_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can read own sessions"
  ON game_sessions FOR SELECT
  USING (auth.uid() = player_one OR auth.uid() = player_two);

CREATE POLICY "Players can insert sessions (as player_one)"
  ON game_sessions FOR INSERT
  WITH CHECK (auth.uid() = player_one);

CREATE POLICY "Players can update own sessions"
  ON game_sessions FOR UPDATE
  USING (auth.uid() = player_one OR auth.uid() = player_two)
  WITH CHECK (auth.uid() = player_one OR auth.uid() = player_two);

CREATE INDEX IF NOT EXISTS idx_game_sessions_chat_id ON game_sessions(chat_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_players ON game_sessions(player_one, player_two);

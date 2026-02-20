-- ArmPal Arena: 1v1 match tables + player stats + leaderboard view
CREATE TABLE IF NOT EXISTS public.arena_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot1_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  slot2_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'ended')),
  started_at timestamptz,
  ended_at timestamptz,
  winner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_arena_matches_status ON public.arena_matches(status);
CREATE INDEX IF NOT EXISTS idx_arena_matches_host ON public.arena_matches(host_user_id);

CREATE TABLE IF NOT EXISTS public.arena_match_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.arena_matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot integer NOT NULL CHECK (slot IN (1, 2)),
  kills integer NOT NULL DEFAULT 0,
  deaths integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(match_id, slot)
);

CREATE INDEX IF NOT EXISTS idx_arena_match_players_match ON public.arena_match_players(match_id);
CREATE INDEX IF NOT EXISTS idx_arena_match_players_user ON public.arena_match_players(user_id);

CREATE TABLE IF NOT EXISTS public.arena_player_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  matches_played integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  kills integer NOT NULL DEFAULT 0,
  deaths integer NOT NULL DEFAULT 0,
  rating integer NOT NULL DEFAULT 1000,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE OR REPLACE VIEW public.arena_leaderboard AS
SELECT
  s.user_id,
  p.display_name,
  p.username,
  s.rating,
  s.wins,
  s.losses,
  s.kills,
  s.deaths,
  CASE WHEN s.deaths > 0 THEN ROUND((s.kills::numeric / s.deaths), 2) ELSE s.kills END AS kd_ratio
FROM public.arena_player_stats s
LEFT JOIN public.profiles p ON p.id = s.user_id
WHERE s.matches_played > 0
ORDER BY s.rating DESC;

ALTER TABLE public.arena_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_player_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arena_matches_select" ON public.arena_matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "arena_matches_insert" ON public.arena_matches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "arena_matches_update" ON public.arena_matches FOR UPDATE TO authenticated USING (true);

CREATE POLICY "arena_match_players_select" ON public.arena_match_players FOR SELECT TO authenticated USING (true);
CREATE POLICY "arena_match_players_insert" ON public.arena_match_players FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "arena_match_players_update" ON public.arena_match_players FOR UPDATE TO authenticated USING (true);

CREATE POLICY "arena_player_stats_select" ON public.arena_player_stats FOR SELECT TO authenticated USING (true);
CREATE POLICY "arena_player_stats_insert" ON public.arena_player_stats FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "arena_player_stats_update" ON public.arena_player_stats FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Optional: add arena_matches to realtime if you want status sync via postgres_changes
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.arena_matches;

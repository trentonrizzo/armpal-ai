-- ArmPal Arena: add 4-digit join_code to arena_matches
-- Unique among ACTIVE matches only (waiting/active); ended matches may reuse codes later.

ALTER TABLE public.arena_matches
  ADD COLUMN IF NOT EXISTS join_code integer;

-- Uniqueness only for active matches (waiting or active)
CREATE UNIQUE INDEX IF NOT EXISTS idx_arena_matches_join_code_active
  ON public.arena_matches (join_code)
  WHERE status IN ('waiting', 'active') AND join_code IS NOT NULL;

-- Fast lookup by join_code when joining
CREATE INDEX IF NOT EXISTS idx_arena_matches_join_code
  ON public.arena_matches (join_code)
  WHERE join_code IS NOT NULL;

COMMENT ON COLUMN public.arena_matches.join_code IS '4-digit code (1000-9999) for joining; unique among waiting/active matches only.';

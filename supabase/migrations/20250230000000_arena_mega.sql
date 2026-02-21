-- ArmPal Arena Mega Upgrade: leave tracking + keybinds storage

-- Who left the match (null = normal end by time/kills)
ALTER TABLE public.arena_matches
  ADD COLUMN IF NOT EXISTS left_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.arena_matches.left_by_user_id IS 'Set when a player leaves mid-match; other player sees Opponent left.';

-- Per-user key/controller/mobile bindings (JSON per device type)
CREATE TABLE IF NOT EXISTS public.arena_binds (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_type text NOT NULL DEFAULT 'keyboard', -- 'keyboard' | 'gamepad' | 'mobile'
  binds_json jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, device_type)
);

ALTER TABLE public.arena_binds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arena_binds_select_own" ON public.arena_binds
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "arena_binds_insert_own" ON public.arena_binds
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "arena_binds_update_own" ON public.arena_binds
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

COMMENT ON TABLE public.arena_binds IS 'Remappable arena controls per device; keys/buttons stored in binds_json.';

-- Extend arena_settings for camera mode and 2-slot loadout (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'arena_settings' AND column_name = 'camera_mode') THEN
    ALTER TABLE public.arena_settings ADD COLUMN camera_mode text NOT NULL DEFAULT 'first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'arena_settings' AND column_name = 'loadout_primary') THEN
    ALTER TABLE public.arena_settings ADD COLUMN loadout_primary text NOT NULL DEFAULT 'pistol';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'arena_settings' AND column_name = 'loadout_secondary') THEN
    ALTER TABLE public.arena_settings ADD COLUMN loadout_secondary text NOT NULL DEFAULT 'shotgun';
  END IF;
END $$;

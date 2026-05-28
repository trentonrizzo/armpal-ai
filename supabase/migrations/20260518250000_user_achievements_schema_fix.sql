-- Ensure user_achievements exists with achievement_id column (fixes PostgREST schema warnings).

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  achievement_id text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_achievements_user_achievement UNIQUE (user_id, achievement_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_achievements'
      AND column_name = 'achievement_id'
  ) THEN
    ALTER TABLE public.user_achievements ADD COLUMN achievement_id text;
    UPDATE public.user_achievements SET achievement_id = 'legacy' WHERE achievement_id IS NULL;
    ALTER TABLE public.user_achievements ALTER COLUMN achievement_id SET NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_achievements'
      AND column_name = 'unlocked_at'
  ) THEN
    ALTER TABLE public.user_achievements
      ADD COLUMN unlocked_at timestamptz NOT NULL DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_achievements'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.user_achievements
      ADD COLUMN user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS user_achievements_user_id_idx ON public.user_achievements (user_id);
CREATE INDEX IF NOT EXISTS user_achievements_unlocked_at_idx ON public.user_achievements (unlocked_at DESC);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_achievements_select_own" ON public.user_achievements;
CREATE POLICY "user_achievements_select_own"
  ON public.user_achievements FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_achievements_insert_own" ON public.user_achievements;
CREATE POLICY "user_achievements_insert_own"
  ON public.user_achievements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_achievements_delete_own" ON public.user_achievements;
CREATE POLICY "user_achievements_delete_own"
  ON public.user_achievements FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_achievements IS 'ArmPal achievement unlocks; client mirrors to local storage.';

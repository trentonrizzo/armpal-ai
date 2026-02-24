-- RLS for public.arcade_flappy_arm_scores (Flappy Arm score table).
-- We only INSERT into this table; leaderboard view updates via trigger.
-- Idempotent: DO block checks pg_policies so reruns don't error.

DO $$
BEGIN
  -- Enable RLS on arcade_flappy_arm_scores if the table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'arcade_flappy_arm_scores'
  ) THEN
    ALTER TABLE public.arcade_flappy_arm_scores ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$
BEGIN
  -- SELECT: user can read their own rows (only if policy doesn't exist)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'arcade_flappy_arm_scores'
      AND policyname = 'Users can select own flappy arm scores'
  ) AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'arcade_flappy_arm_scores') THEN
    CREATE POLICY "Users can select own flappy arm scores"
      ON public.arcade_flappy_arm_scores FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  -- INSERT: user can insert only their own rows (only if policy doesn't exist)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'arcade_flappy_arm_scores'
      AND policyname = 'Users can insert own flappy arm scores'
  ) AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'arcade_flappy_arm_scores') THEN
    CREATE POLICY "Users can insert own flappy arm scores"
      ON public.arcade_flappy_arm_scores FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Fix programs UPDATE policy to allow unpublish even if purchases exist.

DO $$
BEGIN
  -- Drop old update policy if present
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='programs'
      AND policyname='Programs update own (no purchases)'
  ) THEN
    EXECUTE 'DROP POLICY "Programs update own (no purchases)" ON public.programs';
  END IF;

  -- Recreate: creator can update listing only when published and no purchases
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='programs'
      AND policyname='Programs update own listing (published, no purchases)'
  ) THEN
    CREATE POLICY "Programs update own listing (published, no purchases)"
      ON public.programs FOR UPDATE
      USING (auth.uid() = creator_id AND is_published = true AND NOT public.program_has_purchases(programs.id))
      WITH CHECK (auth.uid() = creator_id AND is_published = true AND NOT public.program_has_purchases(programs.id));
  END IF;

  -- Creator can always unpublish (even if purchases exist). Republish is intentionally blocked.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='programs'
      AND policyname='Programs unpublish own'
  ) THEN
    CREATE POLICY "Programs unpublish own"
      ON public.programs FOR UPDATE
      USING (auth.uid() = creator_id)
      WITH CHECK (auth.uid() = creator_id AND is_published = false);
  END IF;
END $$;


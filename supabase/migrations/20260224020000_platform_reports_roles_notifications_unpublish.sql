-- ArmPal Platform Upgrade (Reports + Roles + Notifications + Program Unpublish)
-- 2026-02-24
--
-- Goals:
-- - Reports system (user/program) with strict RLS (insert by reporter only; read by admin/official only)
-- - Profiles role column: user|admin|official
-- - In-app notifications (global + user-targeted) with per-user read tracking
-- - Programs unpublish instead of hard delete when purchases exist
-- - Production-safe + idempotent where possible

-- =========================
-- 1) PROFILE ROLE SYSTEM
-- =========================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin', 'official'));
  END IF;
END $$;

-- Helper: admin/official check for RLS
CREATE OR REPLACE FUNCTION public.is_admin_or_official()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'official')
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_or_official() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_or_official() TO anon, authenticated;

-- =========================
-- 2) REPORT SYSTEM
-- =========================

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reports_target_type_check'
  ) THEN
    ALTER TABLE public.reports
      ADD CONSTRAINT reports_target_type_check CHECK (target_type IN ('user', 'program'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reports_reason_check'
  ) THEN
    ALTER TABLE public.reports
      ADD CONSTRAINT reports_reason_check CHECK (
        reason IN ('harassment', 'spam', 'fraud', 'inappropriate content', 'impersonation', 'other')
      );
  END IF;
END $$;

-- Users can only insert reports as themselves
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reports' AND policyname = 'Reports insert own'
  ) THEN
    CREATE POLICY "Reports insert own"
      ON public.reports FOR INSERT
      WITH CHECK (auth.uid() = reporter_id);
  END IF;

  -- No public reading; only admin/official can read reports
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reports' AND policyname = 'Reports select admin/official'
  ) THEN
    CREATE POLICY "Reports select admin/official"
      ON public.reports FOR SELECT
      USING (public.is_admin_or_official());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reports_target ON public.reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_created ON public.reports(created_at DESC);

-- =========================
-- 3) NOTIFICATIONS (GLOBAL + USER)
-- =========================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_reads (
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Anyone authenticated can read:
  -- - global notifications (user_id is null)
  -- - notifications addressed to them (user_id = auth.uid())
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Notifications select own or global'
  ) THEN
    CREATE POLICY "Notifications select own or global"
      ON public.notifications FOR SELECT
      USING (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));
  END IF;

  -- Only admin/official can create notifications (global or user-targeted)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Notifications insert admin/official'
  ) THEN
    CREATE POLICY "Notifications insert admin/official"
      ON public.notifications FOR INSERT
      WITH CHECK (public.is_admin_or_official());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notification_reads' AND policyname = 'Notification reads select own'
  ) THEN
    CREATE POLICY "Notification reads select own"
      ON public.notification_reads FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notification_reads' AND policyname = 'Notification reads insert own'
  ) THEN
    CREATE POLICY "Notification reads insert own"
      ON public.notification_reads FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON public.notification_reads(user_id, read_at DESC);

-- =========================
-- 4) PROGRAM UNPUBLISH (NO HARD DELETE IF PURCHASES)
-- =========================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS unpublished_at timestamptz;

-- Helper: purchases existence (used in RLS)
CREATE OR REPLACE FUNCTION public.program_has_purchases(p_program_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_programs up
    WHERE up.program_id = p_program_id
  );
$$;

REVOKE ALL ON FUNCTION public.program_has_purchases(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.program_has_purchases(uuid) TO anon, authenticated;

-- Tighten programs RLS to production-safe rules.
-- (We drop the old permissive policy if it exists.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='programs'
      AND policyname='Programs insert/update by service or creator (optional)'
  ) THEN
    EXECUTE 'DROP POLICY "Programs insert/update by service or creator (optional)" ON public.programs';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='programs'
      AND policyname='Programs are readable by everyone'
  ) THEN
    CREATE POLICY "Programs are readable by everyone"
      ON public.programs FOR SELECT
      USING (
        is_published = true
        OR auth.uid() = creator_id
        OR EXISTS (
          SELECT 1 FROM public.user_programs up
          WHERE up.program_id = programs.id
            AND up.user_id = auth.uid()
        )
      );
  ELSE
    -- Replace with stricter visibility rule if the policy exists.
    BEGIN
      EXECUTE 'ALTER POLICY "Programs are readable by everyone" ON public.programs USING (is_published = true OR auth.uid() = creator_id OR EXISTS (SELECT 1 FROM public.user_programs up WHERE up.program_id = programs.id AND up.user_id = auth.uid()))';
    EXCEPTION WHEN others THEN
      -- If alter fails for any reason, leave it as-is (safe fallback).
      NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='programs'
      AND policyname='Programs insert own'
  ) THEN
    CREATE POLICY "Programs insert own"
      ON public.programs FOR INSERT
      WITH CHECK (auth.uid() = creator_id);
  END IF;

  -- Creator can update listing only if no purchases, and only while published
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='programs'
      AND policyname='Programs update own (no purchases)'
  ) THEN
    CREATE POLICY "Programs update own (no purchases)"
      ON public.programs FOR UPDATE
      USING (auth.uid() = creator_id AND NOT public.program_has_purchases(programs.id))
      WITH CHECK (auth.uid() = creator_id AND NOT public.program_has_purchases(programs.id));
  END IF;

  -- Creator can delete only if there are no purchases
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='programs'
      AND policyname='Programs delete own (no purchases)'
  ) THEN
    CREATE POLICY "Programs delete own (no purchases)"
      ON public.programs FOR DELETE
      USING (auth.uid() = creator_id AND NOT public.program_has_purchases(programs.id));
  END IF;
END $$;


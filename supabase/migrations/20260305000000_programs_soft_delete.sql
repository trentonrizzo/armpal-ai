-- Programs soft delete: add deleted column, update visibility and remove hard delete.

-- 1) Add soft-delete column
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;

-- 2) Remove hard-delete policy so creators only soft-delete
DROP POLICY IF EXISTS "Programs delete own (no purchases)" ON public.programs;

-- 3) Single SELECT policy: marketplace (published + not deleted), creator (own), purchaser (user_programs)
DROP POLICY IF EXISTS "Programs public or own" ON public.programs;
DROP POLICY IF EXISTS "Programs are readable by everyone" ON public.programs;

CREATE POLICY "Programs select visibility"
  ON public.programs FOR SELECT
  USING (
    (is_published = true AND deleted = false)
    OR creator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_programs up
      WHERE up.program_id = programs.id AND up.user_id = auth.uid()
    )
  );

-- 4) Ensure creator can update their own (including setting deleted = true)
-- Existing "Programs update by creator" and "Programs unpublish own" from prior migrations
-- already allow creator to update; no change needed unless a policy blocks deleted.
-- If "Programs update by creator" exists it allows any update by creator - good.
-- If only "Programs update own listing" / "Programs unpublish own" exist, we need
-- a policy that allows creator to set deleted = true. Check: 20260228000000 has
-- "Programs update by creator" WITH CHECK (creator_id = auth.uid()) - so any update
-- by creator is allowed. We're done.

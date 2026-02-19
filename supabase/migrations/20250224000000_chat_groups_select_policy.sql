-- Allow authenticated users to read chat_groups (fix empty Groups UI)
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cg_select_auth" ON public.chat_groups;

CREATE POLICY "cg_select_auth"
  ON public.chat_groups
  FOR SELECT
  TO authenticated
  USING (true);

-- Keep existing UPDATE policy creator-only (do not remove group_update_creator_only).

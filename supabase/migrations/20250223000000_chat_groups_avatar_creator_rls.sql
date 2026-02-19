-- chat_groups: avatar + creator for edit permissions and list preview
ALTER TABLE public.chat_groups
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Only creator can update group (name, avatar)
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_update_creator_only" ON public.chat_groups;
CREATE POLICY "group_update_creator_only"
  ON public.chat_groups
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());


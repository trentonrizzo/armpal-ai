-- Notifications RLS: allow authenticated users to insert user-targeted notifications.
-- user_id = recipient (who receives the notification). Service role retains full access.

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notifications select own or global" ON public.notifications;
DROP POLICY IF EXISTS "Notifications insert admin/official" ON public.notifications;

CREATE POLICY "notifications_select_own"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));

CREATE POLICY "notifications_insert_authenticated"
  ON public.notifications
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND user_id IS NOT NULL
  );

CREATE POLICY "notifications_insert_admin_global"
  ON public.notifications
  FOR INSERT
  WITH CHECK (
    public.is_admin_or_official()
    AND user_id IS NULL
  );

CREATE POLICY "notifications_update_own"
  ON public.notifications
  FOR UPDATE
  USING (user_id = auth.uid());

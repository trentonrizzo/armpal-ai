-- Notifications RLS: use user_id only (column name in table). Service role remains unrestricted.

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
ON public.notifications
FOR SELECT
USING (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert_authenticated" ON public.notifications;
CREATE POLICY "notifications_insert_authenticated"
ON public.notifications
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND user_id IS NOT NULL
);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
ON public.notifications
FOR UPDATE
USING (user_id = auth.uid());

-- Keep admin global insert (user_id NULL) for NotificationsBell
DROP POLICY IF EXISTS "notifications_insert_admin_global" ON public.notifications;
CREATE POLICY "notifications_insert_admin_global"
ON public.notifications
FOR INSERT
WITH CHECK (
  public.is_admin_or_official()
  AND user_id IS NULL
);

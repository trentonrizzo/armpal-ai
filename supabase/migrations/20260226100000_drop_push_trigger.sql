-- Remove pg_net trigger and function that are no longer needed.
-- Push notifications are now handled by the send-push edge function
-- via Supabase Realtime subscription instead.

DROP TRIGGER IF EXISTS trigger_push_on_notification_insert ON public.notifications;
DROP FUNCTION IF EXISTS public.notify_push_on_insert();

-- Server-side push: database triggers → message-push Edge Function → Vercel APNs API
-- Frontend only inserts messages; push delivery is server-owned.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.app_settings IS
  'Internal server config. Set message_push_webhook_url after deploying the message-push edge function.';

INSERT INTO public.app_settings (key, value)
VALUES
  ('message_push_webhook_url', ''),
  ('message_push_webhook_secret', '')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.notify_new_message_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_secret text;
  v_payload jsonb;
BEGIN
  IF NEW.group_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.receiver_id IS NULL OR NEW.sender_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.receiver_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_url FROM public.app_settings WHERE key = 'message_push_webhook_url' LIMIT 1;
  SELECT value INTO v_secret FROM public.app_settings WHERE key = 'message_push_webhook_secret' LIMIT 1;

  IF v_url IS NULL OR btrim(v_url) = '' THEN
    RAISE LOG '[ArmPal.Push.Server] message_push_webhook_url not configured — skipping push';
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'messages',
    'schema', 'public',
    'record', to_jsonb(NEW)
  );

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-message-push-secret', coalesce(v_secret, '')
    ),
    body := v_payload
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[ArmPal.Push.Server] message push trigger failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS new_message_push_trigger ON public.messages;
CREATE TRIGGER new_message_push_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_message_push();

CREATE OR REPLACE FUNCTION public.notify_new_friend_request_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_secret text;
  v_payload jsonb;
BEGIN
  IF NEW.sender_id IS NULL OR NEW.receiver_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_id = NEW.receiver_id THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT NULL AND NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_url FROM public.app_settings WHERE key = 'message_push_webhook_url' LIMIT 1;
  SELECT value INTO v_secret FROM public.app_settings WHERE key = 'message_push_webhook_secret' LIMIT 1;

  IF v_url IS NULL OR btrim(v_url) = '' THEN
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'friend_requests',
    'schema', 'public',
    'record', to_jsonb(NEW)
  );

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-message-push-secret', coalesce(v_secret, '')
    ),
    body := v_payload
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[ArmPal.Push.Server] friend request push trigger failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS new_friend_request_push_trigger ON public.friend_requests;
CREATE TRIGGER new_friend_request_push_trigger
  AFTER INSERT ON public.friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_friend_request_push();

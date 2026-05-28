-- Wire messages INSERT → send-push Edge Function (pg_net).
-- Run once after deploy:
--   SELECT public.configure_send_push_server('YOUR_PROJECT_REF', 'YOUR_WEBHOOK_SECRET');

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_settings (key, value)
VALUES
  ('send_push_webhook_url', ''),
  ('send_push_webhook_secret', ''),
  ('supabase_project_ref', '')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.configure_send_push_server(
  p_project_ref text,
  p_webhook_secret text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_project_ref IS NULL OR btrim(p_project_ref) = '' THEN
    RAISE EXCEPTION 'project_ref is required';
  END IF;

  INSERT INTO public.app_settings (key, value, updated_at)
  VALUES ('supabase_project_ref', btrim(p_project_ref), now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  INSERT INTO public.app_settings (key, value, updated_at)
  VALUES (
    'send_push_webhook_url',
    'https://' || btrim(p_project_ref) || '.supabase.co/functions/v1/send-push',
    now()
  )
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  IF p_webhook_secret IS NOT NULL AND btrim(p_webhook_secret) <> '' THEN
    INSERT INTO public.app_settings (key, value, updated_at)
    VALUES ('send_push_webhook_secret', btrim(p_webhook_secret), now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.configure_send_push_server(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.configure_send_push_server(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_send_push_webhook_url()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_ref text;
BEGIN
  SELECT value INTO v_url
  FROM public.app_settings
  WHERE key = 'send_push_webhook_url'
  LIMIT 1;

  IF v_url IS NOT NULL AND btrim(v_url) <> '' THEN
    RETURN btrim(v_url);
  END IF;

  SELECT value INTO v_url
  FROM public.app_settings
  WHERE key = 'message_push_webhook_url'
  LIMIT 1;

  IF v_url IS NOT NULL AND btrim(v_url) <> '' THEN
    RETURN btrim(v_url);
  END IF;

  SELECT value INTO v_ref
  FROM public.app_settings
  WHERE key = 'supabase_project_ref'
  LIMIT 1;

  IF v_ref IS NOT NULL AND btrim(v_ref) <> '' THEN
    RETURN 'https://' || btrim(v_ref) || '.supabase.co/functions/v1/send-push';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_send_push_webhook_secret()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT value INTO v_secret
  FROM public.app_settings
  WHERE key = 'send_push_webhook_secret'
  LIMIT 1;

  IF v_secret IS NOT NULL AND btrim(v_secret) <> '' THEN
    RETURN btrim(v_secret);
  END IF;

  SELECT value INTO v_secret
  FROM public.app_settings
  WHERE key = 'message_push_webhook_secret'
  LIMIT 1;

  RETURN coalesce(v_secret, '');
END;
$$;

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

  v_url := public.resolve_send_push_webhook_url();
  v_secret := public.resolve_send_push_webhook_secret();

  IF v_url IS NULL OR btrim(v_url) = '' THEN
    RAISE WARNING '[ArmPal.Push.Server] send_push webhook URL not configured — run configure_send_push_server()';
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
      'x-send-push-secret', coalesce(v_secret, '')
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

  v_url := public.resolve_send_push_webhook_url();
  v_secret := public.resolve_send_push_webhook_secret();

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
      'x-send-push-secret', coalesce(v_secret, '')
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

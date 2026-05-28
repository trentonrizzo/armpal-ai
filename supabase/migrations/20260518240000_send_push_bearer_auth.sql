-- Fix pg_net → send-push auth: Authorization Bearer must match Edge Function secret.
-- After deploy, run once (replace values):
--   SELECT public.configure_send_push_server('YOUR_PROJECT_REF', 'YOUR_WEBHOOK_SECRET');
-- Set the same secret in Supabase Edge secrets:
--   SEND_PUSH_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET

INSERT INTO public.app_settings (key, value)
VALUES ('send_push_secret', '')
ON CONFLICT (key) DO NOTHING;

-- Keep legacy keys in sync with canonical send_push_secret.
UPDATE public.app_settings AS canonical
SET value = legacy.value, updated_at = now()
FROM public.app_settings AS legacy
WHERE canonical.key = 'send_push_secret'
  AND legacy.key = 'send_push_webhook_secret'
  AND btrim(coalesce(canonical.value, '')) = ''
  AND btrim(coalesce(legacy.value, '')) <> '';

UPDATE public.app_settings AS legacy
SET value = canonical.value, updated_at = now()
FROM public.app_settings AS canonical
WHERE legacy.key = 'send_push_webhook_secret'
  AND canonical.key = 'send_push_secret'
  AND btrim(coalesce(legacy.value, '')) = ''
  AND btrim(coalesce(canonical.value, '')) <> '';

CREATE OR REPLACE FUNCTION public.ensure_send_push_settings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_secret text;
  v_ref text;
BEGIN
  v_url := public.resolve_send_push_webhook_url();
  v_secret := public.resolve_send_push_webhook_secret();

  IF v_url IS NULL OR btrim(v_url) = '' THEN
    SELECT value INTO v_ref
    FROM public.app_settings
    WHERE key = 'supabase_project_ref'
    LIMIT 1;

    IF v_ref IS NOT NULL AND btrim(v_ref) <> '' THEN
      v_url := 'https://' || btrim(v_ref) || '.supabase.co/functions/v1/send-push';

      INSERT INTO public.app_settings (key, value, updated_at)
      VALUES ('send_push_webhook_url', v_url, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
    END IF;
  END IF;

  IF v_secret IS NULL OR btrim(v_secret) = '' THEN
    v_secret := encode(gen_random_bytes(32), 'hex');

    INSERT INTO public.app_settings (key, value, updated_at)
    VALUES
      ('send_push_secret', v_secret, now()),
      ('send_push_webhook_secret', v_secret, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

    RAISE WARNING '[ArmPal.Push.Server] send_push_secret was missing — generated new secret. Set SEND_PUSH_WEBHOOK_SECRET in Edge Function secrets to: %', v_secret;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_send_push_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_send_push_settings() TO service_role;

CREATE OR REPLACE FUNCTION public.configure_send_push_server(
  p_project_ref text,
  p_webhook_secret text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
BEGIN
  IF p_project_ref IS NULL OR btrim(p_project_ref) = '' THEN
    RAISE EXCEPTION 'project_ref is required';
  END IF;

  v_secret := btrim(coalesce(p_webhook_secret, ''));
  IF v_secret = '' THEN
    v_secret := public.resolve_send_push_webhook_secret();
  END IF;
  IF v_secret = '' THEN
    v_secret := encode(gen_random_bytes(32), 'hex');
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

  INSERT INTO public.app_settings (key, value, updated_at)
  VALUES
    ('send_push_secret', v_secret, now()),
    ('send_push_webhook_secret', v_secret, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
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
  WHERE key = 'send_push_secret'
  LIMIT 1;

  IF v_secret IS NOT NULL AND btrim(v_secret) <> '' THEN
    RETURN btrim(v_secret);
  END IF;

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

  RETURN coalesce(nullif(btrim(v_secret), ''), '');
END;
$$;

CREATE OR REPLACE FUNCTION public.build_send_push_headers(p_secret text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_secret text;
BEGIN
  v_secret := btrim(coalesce(p_secret, ''));
  IF v_secret = '' THEN
    RAISE EXCEPTION 'send_push secret is empty';
  END IF;

  RETURN jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || v_secret,
    'x-send-push-secret', v_secret
  );
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

  PERFORM public.ensure_send_push_settings();

  v_url := public.resolve_send_push_webhook_url();
  v_secret := public.resolve_send_push_webhook_secret();

  IF v_url IS NULL OR btrim(v_url) = '' THEN
    RAISE WARNING '[ArmPal.Push.Server] send_push webhook URL not configured — run configure_send_push_server(project_ref, secret)';
    RETURN NEW;
  END IF;

  IF v_secret IS NULL OR btrim(v_secret) = '' THEN
    RAISE WARNING '[ArmPal.Push.Server] send_push_secret missing after ensure_send_push_settings()';
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
    headers := public.build_send_push_headers(v_secret),
    body := v_payload
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[ArmPal.Push.Server] message push trigger failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

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

  PERFORM public.ensure_send_push_settings();

  v_url := public.resolve_send_push_webhook_url();
  v_secret := public.resolve_send_push_webhook_secret();

  IF v_url IS NULL OR btrim(v_url) = '' THEN
    RETURN NEW;
  END IF;

  IF v_secret IS NULL OR btrim(v_secret) = '' THEN
    RAISE WARNING '[ArmPal.Push.Server] send_push_secret missing for friend request push';
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
    headers := public.build_send_push_headers(v_secret),
    body := v_payload
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[ArmPal.Push.Server] friend request push trigger failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

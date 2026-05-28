-- pg_net → send-push uses x-arm-pal-push-secret (no Supabase JWT).
-- After deploy:
--   SELECT public.configure_send_push_server('YOUR_PROJECT_REF', 'YOUR_SEND_PUSH_SECRET');
--   supabase secrets set SEND_PUSH_SECRET=YOUR_SEND_PUSH_SECRET

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
    'x-arm-pal-push-secret', v_secret
  );
END;
$$;

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

    RAISE WARNING '[ArmPal.Push.Server] send_push_secret was missing — generated %. Set SEND_PUSH_SECRET edge secret to match.', v_secret;
  END IF;
END;
$$;

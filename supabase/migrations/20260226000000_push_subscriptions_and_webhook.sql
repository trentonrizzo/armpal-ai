-- push_subscriptions: stores Web Push subscriptions per user
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  keys jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Unique constraint: one subscription per user per endpoint
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_user_endpoint_unique
  UNIQUE (user_id, endpoint);

-- RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow service role full access (for edge function cleanup)
CREATE POLICY "Service role full access"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger function: call send-push edge function on notification insert
CREATE OR REPLACE FUNCTION public.notify_push_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _url text;
  _key text;
BEGIN
  -- Only fire for user-targeted notifications (skip globals where user_id IS NULL)
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO _url
    FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_URL'
    LIMIT 1;

  SELECT decrypted_secret INTO _key
    FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
    LIMIT 1;

  -- Fallback: use env config if vault is not set up
  IF _url IS NULL THEN
    _url := current_setting('app.settings.supabase_url', true);
  END IF;
  IF _key IS NULL THEN
    _key := current_setting('app.settings.service_role_key', true);
  END IF;

  -- Fire-and-forget HTTP call to the edge function
  PERFORM net.http_post(
    url := _url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _key
    ),
    body := jsonb_build_object(
      'record', jsonb_build_object(
        'user_id', NEW.user_id,
        'title', COALESCE(NEW.title, 'ArmPal'),
        'body', COALESCE(NEW.body, 'New notification'),
        'link', COALESCE(NEW.link, '/')
      )
    )
  );

  RETURN NEW;
END;
$$;

-- Attach trigger to notifications table
DROP TRIGGER IF EXISTS trigger_push_on_notification_insert ON public.notifications;
CREATE TRIGGER trigger_push_on_notification_insert
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push_on_insert();

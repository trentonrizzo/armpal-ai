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

-- Enable realtime for the notifications table so the edge function
-- can subscribe to INSERT events via Supabase Realtime.
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

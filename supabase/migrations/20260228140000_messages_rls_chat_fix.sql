-- Fix chat messages being rejected by RLS (INSERT blocked → 403, message disappears).
-- Table: messages (sender_id, receiver_id). Do not modify notifications.

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_own_messages" ON public.messages;
CREATE POLICY "insert_own_messages"
ON public.messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
);

DROP POLICY IF EXISTS "select_conversation_messages" ON public.messages;
CREATE POLICY "select_conversation_messages"
ON public.messages
FOR SELECT
USING (
  auth.uid() = sender_id
  OR auth.uid() = receiver_id
);

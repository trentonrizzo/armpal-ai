-- ai_conversations: multi-conversation support for ArmPal AI
-- Run this in Supabase SQL editor or via migration.

-- New table (user_id references your auth users; add FK if needed)
CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- RLS: users can only see/edit their own conversations
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own ai_conversations"
  ON ai_conversations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add conversation_id to ai_messages (nullable for existing rows)
ALTER TABLE ai_messages
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES ai_conversations(id) ON DELETE CASCADE;

-- Optional: index for listing messages by conversation
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id);

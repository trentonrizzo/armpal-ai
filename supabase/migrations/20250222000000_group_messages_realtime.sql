-- group_messages: dedicated table for group chat (realtime sync)
CREATE TABLE IF NOT EXISTS group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text text,
  image_url text,
  video_url text,
  audio_url text,
  audio_duration numeric,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_messages_group_created
  ON group_messages(group_id, created_at);

ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow group members insert"
  ON group_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow group members select"
  ON group_messages
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow delete own group message"
  ON group_messages
  FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;

-- Align group_messages columns with frontend payload (fix persistence)
ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS text text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS audio_duration integer;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'group_messages'
      AND column_name = 'message'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.group_messages ALTER COLUMN message DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS message text;

ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gm_select" ON public.group_messages;
DROP POLICY IF EXISTS "gm_insert" ON public.group_messages;
DROP POLICY IF EXISTS "Allow group members insert" ON public.group_messages;
DROP POLICY IF EXISTS "Allow group members select" ON public.group_messages;

CREATE POLICY "gm_select"
  ON public.group_messages
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "gm_insert"
  ON public.group_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

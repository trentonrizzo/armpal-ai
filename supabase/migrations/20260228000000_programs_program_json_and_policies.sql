-- Program JSON structure + safer RLS

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS program_json jsonb;

-- Backfill existing parsed_program into program_json if present
UPDATE programs
SET program_json = COALESCE(program_json, parsed_program)
WHERE parsed_program IS NOT NULL;

-- Tighten RLS: only creators can insert/update their own programs,
-- everyone can read published programs, creators can read their own.
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Programs are readable by everyone" ON programs;
DROP POLICY IF EXISTS "Programs insert/update by service or creator (optional)" ON programs;

CREATE POLICY "Programs public or own"
  ON programs FOR SELECT
  USING (
    is_published = true
    OR creator_id = auth.uid()
  );

CREATE POLICY "Programs insert by creator"
  ON programs FOR INSERT
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Programs update by creator"
  ON programs FOR UPDATE
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());


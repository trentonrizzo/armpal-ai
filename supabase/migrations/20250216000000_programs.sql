-- programs: marketplace catalog
CREATE TABLE IF NOT EXISTS programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  preview_description text,
  creator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Programs are readable by everyone"
  ON programs FOR SELECT
  USING (true);

CREATE POLICY "Programs insert/update by service or creator (optional)"
  ON programs FOR ALL
  USING (true)
  WITH CHECK (true);

-- program_logic: one row per program, holds logic_json (frequency_range, layout, etc.)
CREATE TABLE IF NOT EXISTS program_logic (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  logic_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(program_id)
);

ALTER TABLE program_logic ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Program logic readable by everyone"
  ON program_logic FOR SELECT
  USING (true);

CREATE POLICY "Program logic writable (optional)"
  ON program_logic FOR ALL
  USING (true)
  WITH CHECK (true);

-- user_programs: ownership (purchased / acquired)
CREATE TABLE IF NOT EXISTS user_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  acquired_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, program_id)
);

ALTER TABLE user_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own user_programs"
  ON user_programs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own user_programs (buy)"
  ON user_programs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_programs_title ON programs(title);
CREATE INDEX IF NOT EXISTS idx_programs_creator_id ON programs(creator_id);
CREATE INDEX IF NOT EXISTS idx_program_logic_program_id ON program_logic(program_id);
CREATE INDEX IF NOT EXISTS idx_user_programs_user_id ON user_programs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_programs_program_id ON user_programs(program_id);

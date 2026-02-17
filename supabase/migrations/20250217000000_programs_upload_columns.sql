-- Universal program upload support: raw content, parsed program, AI flag
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS raw_content text,
  ADD COLUMN IF NOT EXISTS parsed_program jsonb,
  ADD COLUMN IF NOT EXISTS is_ai_parsed boolean DEFAULT false;

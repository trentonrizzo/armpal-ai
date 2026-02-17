-- Add mode for hub sections (single | multiplayer)
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS mode text DEFAULT 'single';

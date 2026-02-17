-- Add price column for creator-set program price (e.g. 15.99)
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS price numeric(10,2);

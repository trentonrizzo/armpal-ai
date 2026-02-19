-- Find Friends: profiles columns (age, city, state, interests, lat, lng)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS interests text[],
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

CREATE INDEX IF NOT EXISTS idx_profiles_location
  ON profiles(lat, lng);

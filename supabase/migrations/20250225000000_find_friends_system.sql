-- Find Friends: profiles columns + user_interests + find_friends RPC
-- Uses existing profiles table.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS discoverable boolean DEFAULT false;

-- user_interests: one row per (user_id, interest)
CREATE TABLE IF NOT EXISTS public.user_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interest text NOT NULL,
  UNIQUE(user_id, interest)
);

CREATE INDEX IF NOT EXISTS idx_user_interests_user ON public.user_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interests_interest ON public.user_interests(interest);

ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all interests"
  ON public.user_interests FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage own interests"
  ON public.user_interests FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- find_friends: returns discoverable users (excluding self and existing friends), optional filters
CREATE OR REPLACE FUNCTION public.find_friends(
  p_age_min integer DEFAULT NULL,
  p_age_max integer DEFAULT NULL,
  p_location_scope text DEFAULT 'global',
  p_interests text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  display_name text,
  username text,
  avatar_url text,
  age integer,
  city text,
  state text,
  country text,
  interests text[],
  shared_interests text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_id uuid := auth.uid();
BEGIN
  RETURN QUERY
  WITH my_friend_ids AS (
    SELECT (CASE WHEN f.user_id = my_id THEN f.friend_id ELSE f.user_id END) AS fid
    FROM friends f
    WHERE (f.user_id = my_id OR f.friend_id = my_id)
      AND (f.status IS NULL OR f.status = 'accepted')
  ),
  filtered AS (
    SELECT
      p.id,
      p.display_name,
      p.username,
      p.avatar_url,
      p.age,
      p.city,
      p.state,
      p.country,
      COALESCE(
        (SELECT array_agg(ui.interest ORDER BY ui.interest)
         FROM user_interests ui WHERE ui.user_id = p.id),
        ARRAY[]::text[]
      ) AS interests
    FROM profiles p
    WHERE p.id IS NOT NULL
      AND p.id != my_id
      AND (p.discoverable = true)
      AND NOT EXISTS (SELECT 1 FROM my_friend_ids m WHERE m.fid = p.id)
      AND (p_age_min IS NULL OR p.age IS NULL OR p.age >= p_age_min)
      AND (p_age_max IS NULL OR p.age IS NULL OR p.age <= p_age_max)
      AND (
        p_location_scope = 'global'
        OR (p_location_scope = 'country' AND p.country IS NOT NULL AND p.country = (SELECT country FROM profiles WHERE id = my_id))
        OR (p_location_scope = 'state' AND p.state IS NOT NULL AND p.state = (SELECT state FROM profiles WHERE id = my_id))
        OR (p_location_scope = 'local' AND p.city IS NOT NULL AND p.city = (SELECT city FROM profiles WHERE id = my_id))
      )
      AND (
        p_interests IS NULL OR array_length(p_interests, 1) IS NULL
        OR EXISTS (
          SELECT 1 FROM user_interests ui
          WHERE ui.user_id = p.id AND ui.interest = ANY(p_interests)
        )
      )
  )
  SELECT
    f.id,
    f.display_name,
    f.username,
    f.avatar_url,
    f.age,
    f.city,
    f.state,
    f.country,
    f.interests,
    CASE
      WHEN p_interests IS NOT NULL AND array_length(p_interests, 1) > 0 THEN
        (SELECT array_agg(t.interest) FROM unnest(f.interests) AS t(interest) WHERE t.interest = ANY(p_interests))
      ELSE ARRAY[]::text[]
    END AS shared_interests
  FROM filtered f;
END;
$$;

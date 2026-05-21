-- Official / coaching account flags on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_coaching_account boolean NOT NULL DEFAULT false;

-- Mark the real @ARMPAL official coaching account (case-insensitive handle/username)
UPDATE public.profiles
SET
  is_official = true,
  is_coaching_account = true
WHERE
  lower(coalesce(handle, '')) = 'armpal'
  OR lower(coalesce(username, '')) = 'armpal';

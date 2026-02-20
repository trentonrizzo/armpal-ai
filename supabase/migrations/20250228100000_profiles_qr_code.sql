-- ArmPal: permanent user QR code storage (profile URL: https://www.armpal.net/u/@{handle})
-- QR is generated server-side and stored here; never changed after creation.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS qr_code_url text,
  ADD COLUMN IF NOT EXISTS qr_created boolean DEFAULT false;

COMMENT ON COLUMN public.profiles.qr_code_url IS 'Public URL of user QR code image (Supabase Storage). Set once, never changed.';
COMMENT ON COLUMN public.profiles.qr_created IS 'True after QR has been generated and saved. Prevents regeneration.';

-- ArmPal Pro Referral + Points System
-- Profiles: ensure referral columns + stripe_customer_id for webhook lookup
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Generate unique referral_code for existing users (optional; run once)
-- UPDATE profiles SET referral_code = encode(gen_random_bytes(6), 'hex') WHERE referral_code IS NULL;

-- points_wallet: one row per user
CREATE TABLE IF NOT EXISTS points_wallet (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  lifetime_earned integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE points_wallet ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own wallet"
  ON points_wallet FOR SELECT
  USING (auth.uid() = user_id);

-- Balance updates only via add_points_safe (service role). Users read-only.

-- points_transactions: ledger
CREATE TABLE IF NOT EXISTS points_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  reason text NOT NULL,
  related_user uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_points_transactions_user_created
  ON points_transactions(user_id, created_at DESC);

ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transactions"
  ON points_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- referral_rewards: prevent duplicate rewards
CREATE TABLE IF NOT EXISTS referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(referrer_user_id, referred_user_id, reward_type)
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer
  ON referral_rewards(referrer_user_id);

ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own referral rewards"
  ON referral_rewards FOR SELECT
  USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

-- add_points_safe: server-only (called from service role / edge function)
CREATE OR REPLACE FUNCTION add_points_safe(
  target_user uuid,
  points_amount integer,
  reason_text text,
  related uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
  new_lifetime integer;
BEGIN
  IF points_amount <= 0 THEN
    RETURN;
  END IF;

  INSERT INTO points_wallet (user_id, balance, lifetime_earned, updated_at)
  VALUES (target_user, 0, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE points_wallet
  SET
    balance = points_wallet.balance + points_amount,
    lifetime_earned = points_wallet.lifetime_earned + points_amount,
    updated_at = now()
  WHERE user_id = target_user;

  INSERT INTO points_transactions (user_id, amount, reason, related_user)
  VALUES (target_user, points_amount, reason_text, related);

  RETURN;
END;
$$;

-- Optional: ensure profiles.referral_code is set on insert (trigger)
-- We'll generate in app when user opens profile/referrals
COMMENT ON TABLE points_wallet IS 'ArmPal Credits balance per user';
COMMENT ON TABLE points_transactions IS 'ArmPal Credits transaction log';
COMMENT ON TABLE referral_rewards IS 'Tracks referral rewards to prevent duplicates';

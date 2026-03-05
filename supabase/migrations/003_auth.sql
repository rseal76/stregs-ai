-- STRegs.ai: User Profiles Table
-- Run in Supabase Dashboard → SQL Editor
-- NOTE: Requires migration 001 and 002 to have been run first.
-- NOTE: migration 002 creates a 'users' table — user_profiles is the canonical table going forward.

-- -------------------------------------------------------
-- USER PROFILES
-- Canonical user table linked to Supabase Auth.
-- Tier is set by the Stripe webhook (never by users directly).
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT NOT NULL,
  tier                TEXT NOT NULL DEFAULT 'free'
                        CHECK (tier IN ('free', 'standard', 'pro')),
  stripe_customer_id  TEXT UNIQUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_profiles_email_idx ON user_profiles (email);
CREATE INDEX IF NOT EXISTS user_profiles_stripe_idx ON user_profiles (stripe_customer_id);

-- -------------------------------------------------------
-- ROW LEVEL SECURITY
-- Users can read/write their own profile row only.
-- Service role bypasses RLS (used in API routes).
-- -------------------------------------------------------
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profiles_select_own"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "user_profiles_update_own"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Prevent users from self-upgrading tier
    AND tier = (SELECT tier FROM user_profiles WHERE id = auth.uid())
  );

-- -------------------------------------------------------
-- AUTO-CREATE PROFILE ON SIGNUP
-- Triggered when a new user signs up via Supabase Auth.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email)
  VALUES (NEW.id, COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_profile();

-- STRegs.ai: Users + Stripe Subscription Table
-- Run this migration in Supabase SQL Editor or via `supabase db push`

-- -------------------------------------------------------
-- USERS
-- Stores user profile and Stripe subscription info.
-- Linked to Supabase Auth via auth.users FK.
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
                          REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 TEXT NOT NULL UNIQUE,
  stripe_customer_id    TEXT UNIQUE,
  subscription_tier     TEXT NOT NULL DEFAULT 'free'
                          CHECK (subscription_tier IN ('free', 'standard', 'pro')),
  subscription_status   TEXT NOT NULL DEFAULT 'active'
                          CHECK (subscription_status IN (
                            'active', 'trialing', 'past_due', 'cancelled',
                            'incomplete', 'incomplete_expired', 'unpaid', 'paused'
                          )),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE INDEX IF NOT EXISTS users_stripe_customer_idx ON users (stripe_customer_id);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_users_updated_at ON users;
CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- Users can only read and update their own row.
-- Service role (used in API routes) bypasses RLS.
-- -------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: users can read their own record
CREATE POLICY "users_select_own"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Policy: users can update their own record (email only — tier is server-controlled)
CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Prevent users from self-upgrading tier without Stripe
    AND subscription_tier = (SELECT subscription_tier FROM users WHERE id = auth.uid())
  );

-- Policy: server can insert new user records (via service role, bypasses RLS)
-- No INSERT policy needed for client — use server-side API routes

-- -------------------------------------------------------
-- Update lookups table to track user_id properly
-- -------------------------------------------------------
ALTER TABLE lookups
  ADD COLUMN IF NOT EXISTS user_tier TEXT DEFAULT 'free';

-- -------------------------------------------------------
-- Backfill: auto-create user row on new Supabase Auth signup
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

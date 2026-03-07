-- STRegs.ai: Tracked Properties (portfolio monitoring)
-- Run in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS tracked_properties (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  address       text NOT NULL,
  jurisdiction  text,
  state         text,
  status        text,
  last_checked  timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tracked_properties_user_idx ON tracked_properties(user_id);

ALTER TABLE tracked_properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tracked_properties_own" ON tracked_properties;
CREATE POLICY "tracked_properties_own"
  ON tracked_properties
  USING (auth.uid() = user_id);

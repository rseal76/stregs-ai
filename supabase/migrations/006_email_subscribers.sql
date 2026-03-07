-- STRegs.ai: Email Subscribers (change alerts + general list)
-- Run in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS email_subscribers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  source        text,          -- 'change_alert' | 'save_report' | 'general'
  address       text,          -- the STR address they looked up
  jurisdiction  text,          -- jurisdiction returned at time of signup
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_subscribers_email_idx ON email_subscribers(email);

-- Public insert allowed (anon users can subscribe)
ALTER TABLE email_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_subscribers_insert" ON email_subscribers FOR INSERT WITH CHECK (true);
-- Only service role can read

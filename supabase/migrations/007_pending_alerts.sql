-- STRegs.ai: Pending Alerts Queue
-- Run in Supabase Dashboard → SQL Editor after migrations 005 and 006

CREATE TABLE IF NOT EXISTS pending_alerts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id         uuid REFERENCES email_subscribers(id) ON DELETE CASCADE,
  email                 text NOT NULL,
  jurisdiction_name     text NOT NULL,
  jurisdiction_state    text,
  address               text,
  regulation_updated_at timestamptz,
  sent_at               timestamptz,        -- null = not sent yet
  created_at            timestamptz DEFAULT now(),
  UNIQUE(subscriber_id, jurisdiction_name)  -- one pending alert per jurisdiction per subscriber
);

CREATE INDEX IF NOT EXISTS pending_alerts_unsent_idx ON pending_alerts(sent_at) WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS pending_alerts_email_idx ON pending_alerts(email);

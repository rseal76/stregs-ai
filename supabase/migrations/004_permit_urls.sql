-- STRegs.ai: Add permit_application_url to str_regulations
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE str_regulations
  ADD COLUMN IF NOT EXISTS permit_application_url TEXT;

COMMENT ON COLUMN str_regulations.permit_application_url IS
  'Direct URL to apply for an STR permit online. Shown to Standard/Pro users when permit_required = true.';

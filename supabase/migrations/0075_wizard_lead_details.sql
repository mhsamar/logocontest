-- 0075 Wizard leads: details and an alert (owner, 2026-10-25). People who start a contest but don't sign up: the
-- team sees what they typed on the first step (name, email, the WhatsApp tick, next to the mobile number already
-- kept) and gets one alert per person if they still haven't signed up a little later (notify.lead_alert_minutes).
-- Still deleted after 90 days. Only the server writes these rows.
-- Run in Supabase → SQL Editor, ONE BLOCK AT A TIME, in order. Every block is safe to re-run.

-- ---- Block 1: what the person typed on the first step ---------------------------------------------------------------
alter table public.wizard_leads add column if not exists name text check (name is null or char_length(name) <= 120);
alter table public.wizard_leads add column if not exists email text check (email is null or char_length(email) <= 254);
alter table public.wizard_leads add column if not exists whatsapp boolean;

-- ---- Block 2: one alert per person ----------------------------------------------------------------------------------
alter table public.wizard_leads add column if not exists alerted_at timestamptz;
create index if not exists wizard_leads_alert_due_idx on public.wizard_leads (created_at) where alerted_at is null;

-- Check: select count(*) from public.wizard_leads where alerted_at is null;

notify pgrst, 'reload schema';

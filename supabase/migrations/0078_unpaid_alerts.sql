-- 0078 Unpaid contests, phase 3 (owner, 2026-10-26; Design/unpaid-contests): instant alerts for the team and automatic
-- reminders to clients. The switches live in settings (no SQL needed for them). This adds to each follow-up how its
-- owner wants to be reminded, and which planned time each "due" / "overdue" alert was already sent for, so each goes
-- once and a new time alerts again. Only the server reads or writes these columns (RLS stays on, no policies).
-- Run in Supabase → SQL Editor. Safe to re-run.

alter table public.unpaid_leads
  add column if not exists remind_by           text[] check (remind_by is null or remind_by <@ array['alert', 'email', 'sms']::text[]),
  add column if not exists due_alerted_for     timestamptz,
  add column if not exists overdue_alerted_for timestamptz;

-- Check: select count(*) filter (where remind_by is not null) as with_remind_by from public.unpaid_leads;

notify pgrst, 'reload schema';

-- Rollback of 0076: the Unpaid page loses its follow-ups, closes and blocks (it still lists unpaid drafts and guests).
-- Run in Supabase → SQL Editor. This deletes the follow-up history, so export it first if it is needed.

drop table if exists public.blocked_contacts;
drop table if exists public.lead_activities;
drop table if exists public.unpaid_leads;

notify pgrst, 'reload schema';

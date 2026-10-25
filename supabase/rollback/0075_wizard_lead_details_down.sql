-- Rollback of 0075: leads keep only the mobile number, brand and step again, and no lead alerts go out.
-- Run in Supabase → SQL Editor.

drop index if exists public.wizard_leads_alert_due_idx;
alter table public.wizard_leads drop column if exists alerted_at;
alter table public.wizard_leads drop column if exists whatsapp;
alter table public.wizard_leads drop column if exists email;
alter table public.wizard_leads drop column if exists name;

notify pgrst, 'reload schema';

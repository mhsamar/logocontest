-- Undo 0057: removes the email log and the email settings, and puts email codes back to 30 minutes.
drop table if exists public.email_log;
alter table public.profiles drop column if exists email_off;
update public.settings set value = '30'::jsonb, updated_at = now() where key = 'auth.email_code_ttl_minutes';

notify pgrst, 'reload schema';

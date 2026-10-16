-- Rollback of 0064: every client profile is shown again.
alter table public.profiles drop column if exists profile_hidden;

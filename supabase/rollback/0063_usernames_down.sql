-- Undo 0063: old usernames stop forwarding, and the change date is forgotten.
alter table public.profiles drop column if exists username_changed_at;
drop table if exists public.username_history;
notify pgrst, 'reload schema';

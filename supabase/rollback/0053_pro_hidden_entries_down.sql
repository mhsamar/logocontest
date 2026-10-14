-- Undo 0053_pro_hidden_entries.sql: every design is shown as before.
alter table public.entries drop column if exists is_hidden;
alter table public.pro_settings drop column if exists f_hidden_entries;
notify pgrst, 'reload schema';

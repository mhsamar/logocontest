-- Undo 0091_home_showcase.sql.
alter table public.entries drop column if exists home_hidden;
alter table public.contests drop column if exists home_show;
notify pgrst, 'reload schema';

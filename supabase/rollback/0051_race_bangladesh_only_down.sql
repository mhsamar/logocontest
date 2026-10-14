-- Undo 0051_race_bangladesh_only.sql: the race counts every account again, wherever they visit from.
drop function if exists public.visit_countries(uuid[], timestamptz, timestamptz);
drop index if exists public.page_views_user_idx;
notify pgrst, 'reload schema';

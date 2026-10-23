-- Rollback of 0073: removes the "last looked" times behind Admin's gold "new" counts and "New" tags (the menu then
-- shows none). Run in Supabase → SQL Editor.

drop function if exists public.admin_seen_visit(uuid, text, int, timestamptz);
drop table if exists public.admin_seen;

notify pgrst, 'reload schema';

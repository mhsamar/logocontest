-- The monthly smartphone and gift box are for Bangladesh only (owner, 2026-10-14). An account whose visits in the
-- month came mostly from outside Bangladesh is left out of that month's race. This counts, for each account, its
-- visits from Bangladesh and from abroad in a period (page_views keeps the country of each visit, never the IP).
-- Down migration: supabase/rollback/0051_race_bangladesh_only_down.sql
create index if not exists page_views_user_idx on public.page_views (user_id, created_at desc) where user_id is not null;

create or replace function public.visit_countries(p_user_ids uuid[], p_from timestamptz, p_to timestamptz)
returns table (user_id uuid, bd_views bigint, abroad_views bigint)
language sql
stable
security definer
set search_path = public
as $$
  select v.user_id,
         count(*) filter (where v.country = 'BD'),
         count(*) filter (where v.country is not null and v.country <> 'BD')
    from public.page_views v
   where v.user_id = any (p_user_ids) and v.created_at >= p_from and v.created_at < p_to
   group by v.user_id;
$$;
revoke all on function public.visit_countries(uuid[], timestamptz, timestamptz) from public, anon, authenticated;

notify pgrst, 'reload schema';

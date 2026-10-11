-- The "live designers" tag on the home page (owner, 2026-10-11): how many designers joined and how many are online
-- now (seen in the last 5 minutes). A signed-in user is marked as seen at most once a minute (src/lib/supabase/proxy.ts).
alter table public.profiles add column if not exists last_seen_at timestamptz;

create index if not exists profiles_designer_seen_idx on public.profiles (last_seen_at desc)
  where role = 'designer' and status = 'active' and is_test = false;

-- The signed-in user marks themself as seen; writes only when the last mark is over a minute old.
create or replace function public.touch_last_seen() returns void
language sql security definer set search_path = public as $$
  update public.profiles set last_seen_at = now()
  where id = auth.uid() and (last_seen_at is null or last_seen_at < now() - interval '1 minute');
$$;
revoke all on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;

-- Being seen is not a profile edit: updated_at moves only when last_seen_at did not change.
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row
  when (old.last_seen_at is not distinct from new.last_seen_at)
  execute function public.touch_updated_at();

insert into public.settings (key, value, type, "group", description) values
  ('home.live_online_min', '10'::jsonb, 'int', 'live', 'Show "designers online now" on the home page only from this many online.'),
  ('home.live_joined_min', '20'::jsonb, 'int', 'live', 'Show the live designers tag on the home page only from this many designers joined.')
on conflict (key) do nothing;

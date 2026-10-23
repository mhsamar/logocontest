-- 0073 What's new in Admin (owner, 2026-10-23). Every menu item can show a gold count of what is new since this admin
-- last looked at that section's page (new contests, designs, sign-ups, payments and so on), and new rows on the page
-- get a "New" tag. This table keeps, per admin and per section, when they last looked (seen_at) and where the "New"
-- tags of the current visit start (visit_since), so tags stay put through filters, reloads and later pages until the
-- admin has been away for a while (timers.admin_visit_minutes). Only the server reads and writes it (RLS on, no
-- policies).
-- Run in Supabase → SQL Editor. Safe to re-run.

create table if not exists public.admin_seen (
  admin_id     uuid not null references public.profiles (id) on delete cascade,
  section      text not null check (section ~ '^[a-z_]{1,32}$'),
  seen_at      timestamptz not null default now(),
  visit_since  timestamptz,
  primary key (admin_id, section)
);

alter table public.admin_seen enable row level security;

-- The admin opened a section's page: returns where its "New" tags start, and records the look. A look within
-- p_gap_minutes of the last one belongs to the same visit (same start); otherwise a new visit starts at the last look.
-- p_first is the start for an admin's very first look (the start of today).
create or replace function public.admin_seen_visit(p_admin uuid, p_section text, p_gap_minutes int, p_first timestamptz)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  r public.admin_seen;
  v_since timestamptz;
begin
  select * into r from public.admin_seen where admin_id = p_admin and section = p_section for update;
  if not found then
    insert into public.admin_seen (admin_id, section, seen_at, visit_since) values (p_admin, p_section, now(), p_first)
    on conflict (admin_id, section) do nothing;
    return p_first;
  end if;
  v_since := case when r.visit_since is not null and r.seen_at > now() - make_interval(mins => greatest(p_gap_minutes, 1)) then r.visit_since else r.seen_at end;
  update public.admin_seen set seen_at = greatest(seen_at, now()), visit_since = v_since where admin_id = p_admin and section = p_section;
  return v_since;
end $$;

revoke all on function public.admin_seen_visit(uuid, text, int, timestamptz) from public, anon, authenticated;

-- Check: select * from public.admin_seen;

notify pgrst, 'reload schema';

-- Logins and devices (owner, 2026-10-14).
--
-- Every login is one row here: when, which device, browser and system, the IP address and the city and country it came
-- from. A new login beyond the device limit (Settings → security.max_devices, staff security.admin_max_devices, the Super
-- admin one device) signs the oldest login out. Staff are signed out after security.admin_idle_minutes without using the
-- site, and when every admin tab was closed. Admin › Sign-ins shows these rows; Admin › Staff activity (Super admin) adds
-- the time each staff member really worked and what they did. Rows are deleted 180 days after the login ended.
--
-- Run the two blocks one at a time. Down migration: supabase/rollback/0055_login_sessions_down.sql

-- ---- Block 1: the logins --------------------------------------------------------------------------------------
create table if not exists public.user_sessions (
  id               uuid primary key,                                              -- the login's own id (auth.sessions.id)
  user_id          uuid not null references public.profiles (id) on delete cascade,
  created_at       timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  heartbeat_at     timestamptz,                                                   -- staff: an open admin tab checked in
  last_active_at   timestamptz not null default now(),                            -- staff: last click, key, scroll or touch
  bye_at           timestamptz,                                                   -- staff: a tab was closed or reloaded
  active_seconds   int not null default 0 check (active_seconds >= 0),            -- staff: time really working
  ended_at         timestamptz,
  end_reason       text check (end_reason is null or end_reason in ('logout', 'device_limit', 'one_device', 'admin', 'idle', 'tab_closed', 'password_reset', 'deleted', 'time_up')),
  ip               text check (ip is null or char_length(ip) <= 64),
  country          text check (country is null or char_length(country) <= 2),
  city             text check (city is null or char_length(city) <= 80),
  device           text check (device is null or device in ('mobile', 'tablet', 'desktop')),
  browser          text check (browser is null or char_length(browser) <= 40),
  os               text check (os is null or char_length(os) <= 40),
  user_agent       text check (user_agent is null or char_length(user_agent) <= 400),
  impersonated_by  uuid references public.profiles (id) on delete set null       -- an admin's "Log in as this user"
);
create index if not exists user_sessions_user_idx on public.user_sessions (user_id, created_at desc);
create index if not exists user_sessions_open_idx on public.user_sessions (user_id, last_seen_at desc) where ended_at is null;
create index if not exists user_sessions_created_idx on public.user_sessions (created_at desc);
alter table public.user_sessions enable row level security;
-- No policies: only the server and the functions below read or write it.

-- ---- Block 2: signing logins out, the per-request check and the admin tab's check-in ---------------------------
create or replace function public.end_sessions(p_ids uuid[], p_reason text) returns int
language plpgsql security definer set search_path = public, auth as $$
declare n int;
begin
  update public.user_sessions set ended_at = now(), end_reason = p_reason where id = any (p_ids) and ended_at is null;
  get diagnostics n = row_count;
  -- The login itself: its refresh token stops working at once. (If the database ever refuses this, the site still
  -- signs the login out at its next page, from ended_at.)
  begin
    delete from auth.sessions where id = any (p_ids);
  exception when insufficient_privilege then null;
  end;
  return n;
end $$;
revoke all on function public.end_sessions(uuid[], text) from public, anon, authenticated;

create or replace function public.setting_int(p_key text, p_default int) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::int from public.settings where key = p_key), p_default);
$$;
create or replace function public.setting_bool(p_key text, p_default boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::boolean from public.settings where key = p_key), p_default);
$$;
revoke all on function public.setting_int(text, int) from public, anon, authenticated;
revoke all on function public.setting_bool(text, boolean) from public, anon, authenticated;

-- Called by the site at most once a minute per login: records a new login (and applies the device limit), keeps
-- "last seen", and answers 'ended:<reason>' when this login was signed out.
create or replace function public.session_touch(p_session uuid, p_ip text, p_country text, p_city text, p_device text, p_browser text, p_os text, p_ua text)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s public.user_sessions%rowtype;
  prof public.profiles%rowtype;
  staff boolean;
  lim int;
  old_ids uuid[];
begin
  if uid is null or p_session is null then return 'none'; end if;
  select * into prof from public.profiles where id = uid;
  if not found then return 'none'; end if;
  staff := prof.role = 'admin';
  select * into s from public.user_sessions where id = p_session;
  if found then
    if s.user_id <> uid then return 'none'; end if;
    if s.ended_at is not null then return 'ended:' || coalesce(s.end_reason, 'admin'); end if;
    if s.impersonated_by is not null and s.created_at < now() - make_interval(mins => public.setting_int('security.impersonate_minutes', 60)) then
      perform public.end_sessions(array[p_session], 'time_up');
      return 'ended:time_up';
    end if;
    if staff and s.impersonated_by is null then
      if s.last_active_at < now() - make_interval(mins => public.setting_int('security.admin_idle_minutes', 30)) then
        perform public.end_sessions(array[p_session], 'idle');
        return 'ended:idle';
      end if;
      if public.setting_bool('security.admin_close_tab_signout', true) and s.heartbeat_at is not null
         and (s.heartbeat_at < now() - interval '5 minutes' or (s.bye_at is not null and s.bye_at >= s.heartbeat_at and s.bye_at < now() - interval '45 seconds')) then
        perform public.end_sessions(array[p_session], 'tab_closed');
        return 'ended:tab_closed';
      end if;
    end if;
    update public.user_sessions
       set last_seen_at = now(), ip = coalesce(p_ip, ip), country = coalesce(p_country, country), city = coalesce(p_city, city)
     where id = p_session;
    return 'ok';
  end if;

  -- A new login.
  insert into public.user_sessions (id, user_id, ip, country, city, device, browser, os, user_agent, heartbeat_at)
  values (p_session, uid, left(p_ip, 64), left(p_country, 2), left(p_city, 80),
          case when p_device in ('mobile', 'tablet', 'desktop') then p_device end, left(p_browser, 40), left(p_os, 40), left(p_ua, 400),
          case when staff then now() end);
  if staff and prof.is_super_admin and public.setting_bool('security.super_admin_one_device', true) then
    lim := 1;
  elsif staff then
    lim := public.setting_int('security.admin_max_devices', 2);
  else
    lim := public.setting_int('security.max_devices', 3);
  end if;
  select array_agg(o.id) into old_ids from (
    select id from public.user_sessions
     where user_id = uid and ended_at is null and impersonated_by is null and id <> p_session
     order by last_seen_at desc
    offset greatest(lim - 1, 0)
  ) o;
  if old_ids is not null then
    perform public.end_sessions(old_ids, case when lim = 1 then 'one_device' else 'device_limit' end);
  end if;
  return 'ok';
end $$;
revoke all on function public.session_touch(uuid, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.session_touch(uuid, text, text, text, text, text, text, text) to authenticated;

-- The open admin tab checks in every minute: how long ago the admin last clicked or typed, or that the tab is closing.
create or replace function public.session_heartbeat(p_session uuid, p_idle_seconds int, p_bye boolean)
returns text language plpgsql security definer set search_path = public as $$
declare s public.user_sessions%rowtype;
begin
  select * into s from public.user_sessions where id = p_session and user_id = auth.uid();
  if not found then return 'none'; end if;
  if s.ended_at is not null then return 'ended:' || coalesce(s.end_reason, 'admin'); end if;
  if p_bye then
    update public.user_sessions set bye_at = now() where id = p_session;
    return 'ok';
  end if;
  update public.user_sessions
     set heartbeat_at = now(),
         last_seen_at = now(),
         last_active_at = greatest(last_active_at, now() - make_interval(secs => least(greatest(coalesce(p_idle_seconds, 0), 0), 86400))),
         active_seconds = active_seconds + case when coalesce(p_idle_seconds, 0) <= 90 and s.heartbeat_at is not null
                                                then least(greatest(extract(epoch from now() - s.heartbeat_at)::int, 0), 120) else 0 end
   where id = p_session
   returning * into s;
  if s.impersonated_by is null and exists (select 1 from public.profiles where id = s.user_id and role = 'admin')
     and s.last_active_at < now() - make_interval(mins => public.setting_int('security.admin_idle_minutes', 30)) then
    perform public.end_sessions(array[p_session], 'idle');
    return 'ended:idle';
  end if;
  return 'ok';
end $$;
revoke all on function public.session_heartbeat(uuid, int, boolean) from public, anon;
grant execute on function public.session_heartbeat(uuid, int, boolean) to authenticated;

-- The lifecycle job: staff logins that went idle or whose tabs were all closed are signed out even if the admin never
-- comes back, and old rows go after 180 days.
create or replace function public.end_stale_sessions() returns int
language plpgsql security definer set search_path = public as $$
declare idle_ids uuid[]; closed_ids uuid[]; n int := 0;
begin
  select array_agg(s.id) into idle_ids from public.user_sessions s join public.profiles p on p.id = s.user_id
   where s.ended_at is null and s.impersonated_by is null and p.role = 'admin'
     and s.last_active_at < now() - make_interval(mins => public.setting_int('security.admin_idle_minutes', 30));
  if idle_ids is not null then n := n + public.end_sessions(idle_ids, 'idle'); end if;
  if public.setting_bool('security.admin_close_tab_signout', true) then
    select array_agg(s.id) into closed_ids from public.user_sessions s join public.profiles p on p.id = s.user_id
     where s.ended_at is null and s.impersonated_by is null and p.role = 'admin' and s.heartbeat_at < now() - interval '5 minutes';
    if closed_ids is not null then n := n + public.end_sessions(closed_ids, 'tab_closed'); end if;
  end if;
  select array_agg(id) into closed_ids from public.user_sessions
   where ended_at is null and impersonated_by is not null and created_at < now() - make_interval(mins => public.setting_int('security.impersonate_minutes', 60));
  if closed_ids is not null then n := n + public.end_sessions(closed_ids, 'time_up'); end if;
  delete from public.user_sessions where ended_at < now() - interval '180 days';
  return n;
end $$;
revoke all on function public.end_stale_sessions() from public, anon, authenticated;

notify pgrst, 'reload schema';

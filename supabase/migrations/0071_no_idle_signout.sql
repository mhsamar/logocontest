-- 0071 No idle sign-out (owner, 2026-10-22). Nobody is signed out any more for not using the site or for closing it;
-- the only sign-out is a login on one device more than allowed (the oldest login ends). The Super admin may now use
-- 2 devices at the same time (was 1), staff 2 and clients and designers 3 as before. Settings › Logins and devices
-- can still turn the idle sign-out (security.admin_idle_minutes above 0) and the closed-tab sign-out back on.
-- Same three functions as 0055, with: the idle check only when admin_idle_minutes is above 0 (default 0), the
-- closed-tab check off by default, and the Super admin's limit from security.super_admin_max_devices (default 2).
-- Run in Supabase → SQL Editor, ONE BLOCK AT A TIME, in order. Every block is safe to re-run.

-- ---- Block 1: a login checking in (records new logins and applies the device limit) ---------------------------------
create or replace function public.session_touch(p_session uuid, p_ip text, p_country text, p_city text, p_device text, p_browser text, p_os text, p_ua text)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s public.user_sessions%rowtype;
  prof public.profiles%rowtype;
  staff boolean;
  idle int := public.setting_int('security.admin_idle_minutes', 0);
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
      if idle > 0 and s.last_active_at < now() - make_interval(mins => idle) then
        perform public.end_sessions(array[p_session], 'idle');
        return 'ended:idle';
      end if;
      if public.setting_bool('security.admin_close_tab_signout', false) and s.heartbeat_at is not null
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
  if staff and prof.is_super_admin then
    lim := public.setting_int('security.super_admin_max_devices', 2);
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

-- ---- Block 2: the open admin tab checking in once a minute --------------------------------------------------------
create or replace function public.session_heartbeat(p_session uuid, p_idle_seconds int, p_bye boolean)
returns text language plpgsql security definer set search_path = public as $$
declare
  s public.user_sessions%rowtype;
  idle int := public.setting_int('security.admin_idle_minutes', 0);
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
  if idle > 0 and s.impersonated_by is null and exists (select 1 from public.profiles where id = s.user_id and role = 'admin')
     and s.last_active_at < now() - make_interval(mins => idle) then
    perform public.end_sessions(array[p_session], 'idle');
    return 'ended:idle';
  end if;
  return 'ok';
end $$;
revoke all on function public.session_heartbeat(uuid, int, boolean) from public, anon;
grant execute on function public.session_heartbeat(uuid, int, boolean) to authenticated;

-- ---- Block 3: the 15-minute job (only "Log in as" time-ups and, when switched on, idle or closed staff logins) -----
create or replace function public.end_stale_sessions() returns int
language plpgsql security definer set search_path = public as $$
declare
  idle_ids uuid[];
  closed_ids uuid[];
  n int := 0;
  idle int := public.setting_int('security.admin_idle_minutes', 0);
begin
  if idle > 0 then
    select array_agg(s.id) into idle_ids from public.user_sessions s join public.profiles p on p.id = s.user_id
     where s.ended_at is null and s.impersonated_by is null and p.role = 'admin'
       and s.last_active_at < now() - make_interval(mins => idle);
    if idle_ids is not null then n := n + public.end_sessions(idle_ids, 'idle'); end if;
  end if;
  if public.setting_bool('security.admin_close_tab_signout', false) then
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
-- The old one-device switch is replaced by security.super_admin_max_devices.
delete from public.settings where key = 'security.super_admin_one_device';
notify pgrst, 'reload schema';

-- Check (one row, all true):
-- select position('super_admin_max_devices' in pg_get_functiondef('public.session_touch(uuid,text,text,text,text,text,text,text)'::regprocedure)) > 0 as touch,
--        position('idle > 0' in pg_get_functiondef('public.session_heartbeat(uuid,int,boolean)'::regprocedure)) > 0 as heartbeat,
--        position('idle > 0' in pg_get_functiondef('public.end_stale_sessions()'::regprocedure)) > 0 as job;

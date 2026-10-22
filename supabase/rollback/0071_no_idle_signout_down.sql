-- Rollback of 0071: the 0055 sign-out rules again (staff idle sign-out after security.admin_idle_minutes, 30 by
-- default; closed-tab sign-out on by default; the Super admin on one device while security.super_admin_one_device is
-- on, which defaults to on). Also put the old code back (git revert), whose settings registry has those keys.
-- Run in Supabase → SQL Editor.

-- 0 means "never" only in 0071; the 0055 functions would read it as "at once" and sign every staff login out.
delete from public.settings where key = 'security.admin_idle_minutes' and coalesce((value #>> '{}')::int, 0) < 10;

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

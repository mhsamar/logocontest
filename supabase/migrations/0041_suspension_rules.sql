-- Suspension and ban rules (owner, 2026-10-12). Run after 0040 in Supabase → SQL Editor, one block at a time.
-- Safe to re-run. Nothing is dropped.
--
-- Suspension = 48 hours (Settings), then it ends on its own. A suspended user can log in, see everything, send
-- final files and withdraw, but can't send a new design, comment or like/dislike. Each suspension is one row in
-- public.strikes. 3 suspensions within 30 days (Settings) = permanent ban.

-- Block 1. The numbers (Settings).
update public.settings
   set value = '30'::jsonb,
       description = 'Days a suspension counts toward a ban. 3 suspensions (Limits) inside this time = permanent ban.'
 where key = 'timers.strike_expiry_days';
insert into public.settings (key, value, type, "group", description) values
  ('timers.suspension_hours', '48'::jsonb, 'int', 'timers', 'Hours a suspension lasts. It ends on its own.')
on conflict (key) do nothing;

-- Block 2. Every new strike is a suspension; the 3rd within 30 days bans the account instead.
create or replace function public.suspend_after_strike(p_user_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hours int := coalesce((select (value #>> '{}')::int from public.settings where key = 'timers.suspension_hours'), 48);
  v_p public.profiles;
begin
  v_p := public.apply_strike_ladder(p_user_id, 0); -- recount; bans at the limit
  if v_p.status <> 'banned' then
    update public.profiles
       set status = 'suspended',
           suspended_until = greatest(coalesce(suspended_until, now()), now() + make_interval(hours => v_hours))
     where id = p_user_id
    returning * into v_p;
  end if;
  return v_p;
end;
$$;

create or replace function public.give_strike(p_user_id uuid, p_reason text, p_entry_id uuid, p_contest_id uuid, p_issued_by uuid, p_issuer_role text, p_suspend_days int)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.strikes (user_id, reason, entry_id, contest_id, issued_by, issuer_role)
  values (p_user_id, p_reason, p_entry_id, p_contest_id, p_issued_by, p_issuer_role);
  return public.suspend_after_strike(p_user_id);
end;
$$;

create or replace function public.strike_late_files(p_handover_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_h public.handovers;
  v_hours int := coalesce((select (value #>> '{}')::int from public.settings where key = 'timers.files_strike_hours'), 24);
begin
  select * into v_h from public.handovers where id = p_handover_id for update;
  if not found or v_h.status <> 'awaiting_files' or v_h.submitted_at is not null or v_h.late_strike_at is not null
     or v_h.created_at + make_interval(hours => v_hours) > now() then
    return null;
  end if;
  update public.handovers set late_strike_at = now() where id = p_handover_id;
  insert into public.strikes (user_id, reason, entry_id, contest_id, issued_by, issuer_role)
  values (v_h.designer_id, 'Final files not sent within ' || v_hours || ' hours of winning', v_h.entry_id, v_h.contest_id, null, 'system');
  return public.suspend_after_strike(v_h.designer_id);
end;
$$;

revoke all on function public.suspend_after_strike(uuid) from public, anon, authenticated;
revoke all on function public.give_strike(uuid, text, uuid, uuid, uuid, text, int) from public, anon, authenticated;
revoke all on function public.strike_late_files(uuid) from public, anon, authenticated;

-- Block 3. The client agrees to the no-adult-content rule before paying; "adult" is a report reason.
alter table public.contests add column if not exists content_rules_agreed_at timestamptz;
alter type public.report_reason add value if not exists 'adult';

notify pgrst, 'reload schema';

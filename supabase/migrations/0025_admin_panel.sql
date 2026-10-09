-- logocontest.bd — admin panel (milestone 8; owner decisions 2026-10-09, BLUEPRINT.md §10, §13).
-- Run after 0024 in Supabase → SQL Editor. Safe to re-run. Nothing is dropped.

-- Suspensions end on their own (the lifecycle job lifts them).
alter table public.profiles add column if not exists suspended_until timestamptz;

-- One row per strike, so the history shows who gave it and why (§10). profiles.strikes = active count.
create table if not exists public.strikes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  reason       text not null check (char_length(reason) between 3 and 300),
  entry_id     uuid references public.entries (id) on delete set null,
  contest_id   uuid references public.contests (id) on delete set null,
  issued_by    uuid references public.profiles (id) on delete set null,
  issuer_role  text not null check (issuer_role in ('client', 'admin')),
  removed_at   timestamptz,
  removed_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists strikes_user_idx on public.strikes (user_id, created_at desc);
alter table public.strikes enable row level security;

-- Admin cancel (owner, 2026-10-09: reason required, no refund).
alter table public.contests add column if not exists cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 500);
alter table public.contests add column if not exists cancelled_at timestamptz;
alter table public.contests add column if not exists cancelled_by uuid references public.profiles (id) on delete set null;

-- Wizard drop-off (owner, 2026-10-09): the furthest step each anonymous visit reached.
create table if not exists public.wizard_visits (
  id             uuid primary key,
  furthest_step  smallint not null check (furthest_step between 1 and 20),
  contest_id     uuid references public.contests (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists wizard_visits_created_idx on public.wizard_visits (created_at);
alter table public.wizard_visits enable row level security;

-- Homepage: winning logos an admin picked, in order (A-09).
create table if not exists public.featured_logos (
  entry_id    uuid primary key references public.entries (id) on delete cascade,
  position    int not null default 0,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.featured_logos enable row level security;

-- Recount active strikes and apply the ladder: 2 = suspension, 3+ = ban. A ban is never lifted here.
create or replace function public.apply_strike_ladder(p_user_id uuid, p_suspend_days int)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_p public.profiles;
begin
  select count(*) into v_count from public.strikes where user_id = p_user_id and removed_at is null;
  select * into v_p from public.profiles where id = p_user_id for update;
  if v_p.status = 'banned' then
    update public.profiles set strikes = v_count where id = p_user_id returning * into v_p;
  elsif v_count >= 3 then
    update public.profiles set strikes = v_count, status = 'banned', suspended_until = null where id = p_user_id returning * into v_p;
  elsif v_count = 2 then
    update public.profiles
       set strikes = v_count, status = 'suspended',
           suspended_until = greatest(coalesce(suspended_until, now()), now() + make_interval(days => p_suspend_days))
     where id = p_user_id returning * into v_p;
  else
    update public.profiles
       set strikes = v_count,
           status = case when status = 'suspended' then 'active'::public.user_status else status end,
           suspended_until = case when status = 'suspended' then null else suspended_until end
     where id = p_user_id returning * into v_p;
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
  perform 1 from public.profiles where id = p_user_id for update;
  insert into public.strikes (user_id, reason, entry_id, contest_id, issued_by, issuer_role)
  values (p_user_id, p_reason, p_entry_id, p_contest_id, p_issued_by, p_issuer_role);
  return public.apply_strike_ladder(p_user_id, p_suspend_days);
end;
$$;

create or replace function public.remove_strike(p_strike_id uuid, p_admin_id uuid, p_suspend_days int)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  update public.strikes set removed_at = now(), removed_by = p_admin_id
   where id = p_strike_id and removed_at is null
  returning user_id into v_user;
  if v_user is null then
    return null;
  end if;
  return public.apply_strike_ladder(v_user, p_suspend_days);
end;
$$;

-- A-04: decide a report. Upheld removes the design (and closes other open reports on it); an optional
-- strike or ban goes to the designer. Dismissed as false gives the flagger a warning; 3 warnings = ban.
create or replace function public.resolve_report(
  p_report_id uuid,
  p_admin_id uuid,
  p_decision text,
  p_action text,
  p_reason text,
  p_suspend_days int
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_r public.reports;
  v_designer uuid;
  v_contest uuid;
  v_warnings int;
begin
  select * into v_r from public.reports where id = p_report_id for update;
  if not found or v_r.status <> 'open' then
    raise exception 'report % is not open', p_report_id;
  end if;
  if p_decision not in ('upheld', 'dismissed', 'dismissed_false') or p_action not in ('none', 'strike', 'ban') then
    raise exception 'unknown decision' using errcode = 'check_violation';
  end if;
  select designer_id, contest_id into v_designer, v_contest from public.entries where id = v_r.entry_id;

  if p_decision = 'upheld' then
    update public.entries set status = 'removed' where id = v_r.entry_id and status in ('active', 'rejected');
    update public.reports set status = 'upheld', resolved_by = p_admin_id, resolved_at = now()
     where entry_id = v_r.entry_id and status = 'open';
    if p_action = 'strike' then
      perform public.give_strike(v_designer, p_reason, v_r.entry_id, v_contest, p_admin_id, 'admin', p_suspend_days);
    elsif p_action = 'ban' then
      update public.profiles set status = 'banned', suspended_until = null where id = v_designer;
    end if;
  else
    update public.reports set status = p_decision::public.report_status, resolved_by = p_admin_id, resolved_at = now() where id = p_report_id;
    if p_decision = 'dismissed_false' then
      update public.profiles set flag_warnings = flag_warnings + 1 where id = v_r.reporter_id returning flag_warnings into v_warnings;
      if v_warnings >= 3 then
        update public.profiles set status = 'banned', suspended_until = null where id = v_r.reporter_id;
      end if;
    end if;
  end if;

  select * into v_r from public.reports where id = p_report_id;
  return v_r;
end;
$$;

-- A-02: cancel a contest (reason required, no refund). A live handover is cancelled with it.
create or replace function public.admin_cancel_contest(p_contest_id uuid, p_admin_id uuid, p_reason text)
returns public.contests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c public.contests;
begin
  select * into v_c from public.contests where id = p_contest_id for update;
  if not found or v_c.status in ('completed', 'no_result', 'cancelled') then
    raise exception 'contest % cannot be cancelled now', p_contest_id;
  end if;
  update public.handovers set status = 'cancelled'
   where contest_id = p_contest_id and status in ('awaiting_files', 'submitted', 'revision_requested');
  update public.contests
     set status = 'cancelled', cancel_reason = p_reason, cancelled_at = now(), cancelled_by = p_admin_id
   where id = p_contest_id
  returning * into v_c;
  return v_c;
end;
$$;

-- A-02: a free extension by an admin (reason in the audit log). Open contests only.
create or replace function public.admin_extend_contest(p_contest_id uuid, p_days int)
returns public.contests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c public.contests;
begin
  if p_days not between 1 and 30 then
    raise exception 'days must be 1 to 30' using errcode = 'check_violation';
  end if;
  update public.contests
     set ends_at = ends_at + make_interval(days => p_days),
         extensions_count = extensions_count + 1,
         extension_days_total = extension_days_total + p_days
   where id = p_contest_id and status = 'open'
  returning * into v_c;
  if v_c.id is null then
    raise exception 'contest % is not open', p_contest_id;
  end if;
  delete from public.lifecycle_events where contest_id = p_contest_id and kind like 'ending_soon%';
  return v_c;
end;
$$;

-- Wizard drop-off: keep the furthest step of a visit.
create or replace function public.record_wizard_step(p_visit_id uuid, p_step int, p_contest_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.wizard_visits (id, furthest_step, contest_id) values (p_visit_id, p_step, p_contest_id)
  on conflict (id) do update
     set furthest_step = greatest(public.wizard_visits.furthest_step, excluded.furthest_step),
         contest_id = coalesce(excluded.contest_id, public.wizard_visits.contest_id),
         updated_at = now();
$$;

-- Lift suspensions whose time is up (called by the lifecycle job).
create or replace function public.lift_expired_suspensions()
returns int
language sql
security definer
set search_path = public
as $$
  with lifted as (
    update public.profiles set status = 'active', suspended_until = null
     where status = 'suspended' and suspended_until is not null and suspended_until <= now()
    returning 1
  )
  select count(*)::int from lifted;
$$;

revoke all on function public.apply_strike_ladder(uuid, int) from public, anon, authenticated;
revoke all on function public.give_strike(uuid, text, uuid, uuid, uuid, text, int) from public, anon, authenticated;
revoke all on function public.remove_strike(uuid, uuid, int) from public, anon, authenticated;
revoke all on function public.resolve_report(uuid, uuid, text, text, text, int) from public, anon, authenticated;
revoke all on function public.admin_cancel_contest(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_extend_contest(uuid, int) from public, anon, authenticated;
revoke all on function public.record_wizard_step(uuid, int, uuid) from public, anon, authenticated;
revoke all on function public.lift_expired_suspensions() from public, anon, authenticated;

notify pgrst, 'reload schema';

-- Logo check inside contests (owner, 2026-10-14; Design/logo-check/LOGO-CHECK-HANDOFF.md).
-- A designer checks a logo before sending it to a contest. The check is the existing Logo Checker job
-- (logo_checks) with source 'pre_submit': it has the contest, a public report ID, the SHA-256 fingerprint of the
-- exact file, a match score and a level. The entry keeps the check and the fingerprint of its own file; the badge
-- shows only while both fingerprints match. High matches go to Admin > Copyright checker for review.
-- Down migration: supabase/rollback/0047_logo_check_entries_down.sql

-- 1. Checks: the new kind and its report -----------------------------------------------------------
alter table public.logo_checks drop constraint if exists logo_checks_source_check;
alter table public.logo_checks add constraint logo_checks_source_check check (source in ('entry', 'upload', 'designer', 'pre_submit'));

alter table public.logo_checks add column if not exists report_id text;
alter table public.logo_checks add column if not exists file_sha256 text;
alter table public.logo_checks add column if not exists score smallint;
alter table public.logo_checks add column if not exists level text;
alter table public.logo_checks add column if not exists results jsonb;        -- closest results: source name, link, similarity (no image copies)
alter table public.logo_checks add column if not exists sources_count smallint;

alter table public.logo_checks drop constraint if exists logo_checks_report_id_format;
alter table public.logo_checks add constraint logo_checks_report_id_format check (report_id is null or report_id ~ '^LC-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$');
alter table public.logo_checks drop constraint if exists logo_checks_sha_format;
alter table public.logo_checks add constraint logo_checks_sha_format check (file_sha256 is null or file_sha256 ~ '^[0-9a-f]{64}$');
alter table public.logo_checks drop constraint if exists logo_checks_score_range;
alter table public.logo_checks add constraint logo_checks_score_range check (score is null or score between 0 and 100);
alter table public.logo_checks drop constraint if exists logo_checks_level_check;
alter table public.logo_checks add constraint logo_checks_level_check check (level is null or level in ('low', 'medium', 'high'));
-- A designer's contest check always has its contest, report ID and fingerprint.
alter table public.logo_checks drop constraint if exists logo_checks_pre_submit_shape;
alter table public.logo_checks add constraint logo_checks_pre_submit_shape check (source <> 'pre_submit' or (contest_id is not null and report_id is not null and file_sha256 is not null));

create unique index if not exists logo_checks_report_id_key on public.logo_checks (report_id) where report_id is not null;
create index if not exists logo_checks_sha_idx on public.logo_checks (contest_id, file_sha256) where file_sha256 is not null;

-- 2. Entries: the designer's check and the fingerprint of the entry's own file (the cover image) -----
alter table public.entries add column if not exists check_id uuid references public.logo_checks (id) on delete set null;
alter table public.entries add column if not exists file_sha256 text;
alter table public.entries drop constraint if exists entries_sha_format;
alter table public.entries add constraint entries_sha_format check (file_sha256 is null or file_sha256 ~ '^[0-9a-f]{64}$');
create index if not exists entries_check_idx on public.entries (check_id) where check_id is not null;

-- 3. Match levels (Admin > Pro plan, next to the checks per month): Low 0-20, Medium 21-60, High 61+ --------
alter table public.pro_settings add column if not exists check_low_max smallint not null default 20;
alter table public.pro_settings add column if not exists check_medium_max smallint not null default 60;
alter table public.pro_settings drop constraint if exists pro_settings_check_levels;
alter table public.pro_settings add constraint pro_settings_check_levels check (check_low_max between 0 and 98 and check_medium_max > check_low_max and check_medium_max <= 99);

-- 4. High matches for Admin > Copyright checker: keep or remove the entry ----------------------------
create table if not exists public.logo_check_flags (
  id           uuid primary key default gen_random_uuid(),
  check_id     uuid not null references public.logo_checks (id) on delete cascade,
  entry_id     uuid not null references public.entries (id) on delete cascade,
  contest_id   uuid not null references public.contests (id) on delete cascade,
  score        smallint not null check (score between 0 and 100),
  status       text not null default 'open' check (status in ('open', 'kept', 'removed')),
  reviewed_by  uuid references public.profiles (id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (check_id, entry_id)
);
create index if not exists logo_check_flags_open_idx on public.logo_check_flags (status, created_at desc);
alter table public.logo_check_flags enable row level security;
drop policy if exists logo_check_flags_admin on public.logo_check_flags;
create policy logo_check_flags_admin on public.logo_check_flags for select using (public.admin_can('copyright.view'));

-- 5. Who can read a check: the person who asked for it, admins, and the contest's client (a designer's
--    contest check only once it is on a sent entry) ------------------------------------------------------
drop policy if exists logo_checks_read on public.logo_checks;
create policy logo_checks_read on public.logo_checks
  for select using (
    requested_by = auth.uid()
    or public.admin_can('copyright.view')
    or (public.can_read_logo_check(contest_id) and (source <> 'pre_submit' or entry_id is not null))
  );

drop policy if exists logo_check_matches_read on public.logo_check_matches;
create policy logo_check_matches_read on public.logo_check_matches
  for select using (exists (select 1 from public.logo_checks k where k.id = check_id));

-- 6. A client's checks per contest: designers' contest checks don't use them up -----------------------
-- Same as 0043 except the count leaves out source 'pre_submit'.
create or replace function public.start_logo_check(
  p_id uuid, p_request_key uuid, p_contest_id uuid, p_user_id uuid, p_entry_id uuid, p_source text, p_image_path text
)
returns public.logo_checks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contest   public.contests;
  v_check     public.logo_checks;
  v_limit     int;
  v_free_from int;
  v_price     int;
  v_used      int;
  v_free      boolean;
begin
  select * into v_contest from public.contests where id = p_contest_id for update;
  if not found or v_contest.client_id <> p_user_id then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select * into v_check from public.logo_checks where request_key = p_request_key;
  if found then
    return v_check;
  end if;

  if v_contest.status not in ('open', 'judging', 'winner_selected', 'handover') then
    raise exception 'closed' using errcode = 'P0001';
  end if;

  v_free_from := coalesce((select (value #>> '{}')::int from public.settings where key = 'upgrades.logo_check_free_from'), 5000);
  v_price     := coalesce((select (value #>> '{}')::int from public.settings where key = 'upgrades.logo_scan_price'), 250);
  v_free      := v_contest.prize_amount >= v_free_from;
  if v_free then
    v_limit := coalesce((select (value #>> '{}')::int from public.settings where key = 'limits.logo_checks_per_contest'), 20);
  else
    v_limit := coalesce((select (value #>> '{}')::int from public.settings where key = 'limits.logo_checks_paid'), 10);
  end if;

  if not v_free and not v_contest.logo_scan then
    raise exception 'locked' using errcode = 'P0001';
  end if;

  select count(*) into v_used from public.logo_checks where contest_id = p_contest_id and status <> 'failed' and source <> 'pre_submit';
  if v_used >= v_limit then
    raise exception 'limit' using errcode = 'P0001';
  end if;

  if p_source = 'entry' then
    if p_entry_id is null or not exists (
      select 1 from public.entries where id = p_entry_id and contest_id = p_contest_id and status not in ('withdrawn', 'removed')
    ) then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    if exists (select 1 from public.logo_checks where entry_id = p_entry_id and status <> 'failed') then
      raise exception 'checked' using errcode = 'P0001';
    end if;
  elsif p_source <> 'upload' or p_entry_id is not null then
    raise exception 'invalid' using errcode = 'P0001';
  end if;

  insert into public.logo_checks (id, contest_id, entry_id, source, image_path, requested_by, request_key, paid, amount)
  values (p_id, p_contest_id, p_entry_id, p_source, p_image_path, p_user_id, p_request_key, not v_free, case when v_free then 0 else v_price end)
  returning * into v_check;
  return v_check;
end;
$$;
revoke execute on function public.start_logo_check(uuid, uuid, uuid, uuid, uuid, text, text) from public, anon, authenticated;

-- 7. A designer's checks per month count both kinds (own checks and contest checks) -------------------
create or replace function public.start_designer_logo_check(p_id uuid, p_request_key uuid, p_user_id uuid, p_image_path text, p_month date, p_from timestamptz, p_to timestamptz, p_limit int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid;
  v_used int;
begin
  select id into v_existing from public.logo_checks where request_key = p_request_key;
  if found then
    return jsonb_build_object('id', v_existing);
  end if;
  insert into public.logo_check_usage (designer_id, month, used) values (p_user_id, p_month, 0) on conflict do nothing;
  perform 1 from public.logo_check_usage where designer_id = p_user_id and month = p_month for update;
  select count(*) into v_used from public.logo_checks
   where requested_by = p_user_id and source in ('designer', 'pre_submit') and status <> 'failed'
     and created_at >= p_from and created_at < p_to;
  if v_used >= p_limit then
    raise exception 'limit' using errcode = 'check_violation';
  end if;
  insert into public.logo_checks (id, contest_id, entry_id, source, image_path, requested_by, request_key, paid, amount)
  values (p_id, null, null, 'designer', p_image_path, p_user_id, p_request_key, false, 0);
  update public.logo_check_usage set used = v_used + 1, updated_at = now() where designer_id = p_user_id and month = p_month;
  return jsonb_build_object('id', p_id);
end;
$$;
revoke all on function public.start_designer_logo_check(uuid, uuid, uuid, text, date, timestamptz, timestamptz, int) from public, anon, authenticated;

-- 8. Start a designer's contest check: the contest is open, checks are left this month (the usage row is locked,
--    so two requests at once can't both pass), and a double click returns the first check -------------------
create or replace function public.start_entry_logo_check(
  p_id uuid, p_request_key uuid, p_user_id uuid, p_contest_id uuid, p_image_path text, p_report_id text, p_sha256 text,
  p_month date, p_from timestamptz, p_to timestamptz, p_limit int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.logo_checks;
  v_used int;
begin
  select * into v_existing from public.logo_checks where request_key = p_request_key;
  if found then
    if v_existing.requested_by <> p_user_id then
      raise exception 'invalid' using errcode = 'P0001';
    end if;
    return jsonb_build_object('id', v_existing.id, 'report_id', v_existing.report_id);
  end if;
  if not exists (select 1 from public.contests where id = p_contest_id and status = 'open') then
    raise exception 'closed' using errcode = 'P0001';
  end if;
  insert into public.logo_check_usage (designer_id, month, used) values (p_user_id, p_month, 0) on conflict do nothing;
  perform 1 from public.logo_check_usage where designer_id = p_user_id and month = p_month for update;
  select count(*) into v_used from public.logo_checks
   where requested_by = p_user_id and source in ('designer', 'pre_submit') and status <> 'failed'
     and created_at >= p_from and created_at < p_to;
  if v_used >= p_limit then
    raise exception 'limit' using errcode = 'check_violation';
  end if;
  insert into public.logo_checks (id, contest_id, entry_id, source, image_path, requested_by, request_key, paid, amount, report_id, file_sha256)
  values (p_id, p_contest_id, null, 'pre_submit', p_image_path, p_user_id, p_request_key, false, 0, p_report_id, p_sha256);
  update public.logo_check_usage set used = v_used + 1, updated_at = now() where designer_id = p_user_id and month = p_month;
  return jsonb_build_object('id', p_id, 'report_id', p_report_id);
end;
$$;
revoke all on function public.start_entry_logo_check(uuid, uuid, uuid, uuid, text, text, text, date, timestamptz, timestamptz, int) from public, anon, authenticated;

notify pgrst, 'reload schema';

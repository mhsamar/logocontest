-- Undo 0047_logo_check_entries.sql (owner, 2026-10-14). Run only after the app is rolled back.
-- Removes designers' contest checks (source 'pre_submit'), their reports and the high-match flags, and puts back
-- the 0043 / 0046 versions of the start functions and the 0031 read policies.
-- Their checked logos stay in the logo-checks bucket under the check id; delete them in Storage if wanted.

drop function if exists public.start_entry_logo_check(uuid, uuid, uuid, uuid, text, text, text, date, timestamptz, timestamptz, int);

drop table if exists public.logo_check_flags;

alter table public.entries drop constraint if exists entries_sha_format;
drop index if exists public.entries_check_idx;
alter table public.entries drop column if exists check_id;
alter table public.entries drop column if exists file_sha256;

delete from public.logo_checks where source = 'pre_submit';

drop policy if exists logo_checks_read on public.logo_checks;
create policy logo_checks_read on public.logo_checks
  for select using (public.can_read_logo_check(contest_id));
drop policy if exists logo_check_matches_read on public.logo_check_matches;
create policy logo_check_matches_read on public.logo_check_matches
  for select using (exists (select 1 from public.logo_checks k where k.id = check_id and public.can_read_logo_check(k.contest_id)));

drop index if exists public.logo_checks_report_id_key;
drop index if exists public.logo_checks_sha_idx;
alter table public.logo_checks drop constraint if exists logo_checks_pre_submit_shape;
alter table public.logo_checks drop constraint if exists logo_checks_level_check;
alter table public.logo_checks drop constraint if exists logo_checks_score_range;
alter table public.logo_checks drop constraint if exists logo_checks_sha_format;
alter table public.logo_checks drop constraint if exists logo_checks_report_id_format;
alter table public.logo_checks drop column if exists sources_count;
alter table public.logo_checks drop column if exists results;
alter table public.logo_checks drop column if exists level;
alter table public.logo_checks drop column if exists score;
alter table public.logo_checks drop column if exists file_sha256;
alter table public.logo_checks drop column if exists report_id;
alter table public.logo_checks drop constraint if exists logo_checks_source_check;
alter table public.logo_checks add constraint logo_checks_source_check check (source in ('entry', 'upload', 'designer'));

alter table public.pro_settings drop constraint if exists pro_settings_check_levels;
alter table public.pro_settings drop column if exists check_medium_max;
alter table public.pro_settings drop column if exists check_low_max;

-- 0043: a client's checks per contest
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

  select count(*) into v_used from public.logo_checks where contest_id = p_contest_id and status <> 'failed';
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

-- 0046: a designer's own checks per month
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
   where requested_by = p_user_id and source = 'designer' and status <> 'failed'
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

notify pgrst, 'reload schema';

-- Undo 0049_checker_free_and_invites.sql (owner, 2026-10-14). Run only after the app is rolled back.
-- Puts back the 0047 start_logo_check (free from ৳5,000, else the paid add-on) and the 0046 invitation limit.

-- Invitations
create or replace function public.contest_invites_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
begin
  perform 1 from public.contests where id = new.contest_id for update;
  select invites_per_contest into v_max from public.pro_settings where id = 1;
  if (select count(*) from public.contest_invites where contest_id = new.contest_id) >= coalesce(v_max, 10) then
    raise exception 'too_many_invites' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
drop index if exists public.contest_invites_status_idx;
alter table public.contest_invites drop constraint if exists contest_invites_status_check;
alter table public.contest_invites drop column if exists removed_at;
alter table public.contest_invites drop column if exists removed_by;
alter table public.contest_invites drop column if exists responded_at;
alter table public.contest_invites drop column if exists status;

-- Checks and costs
alter table public.logo_checks drop column if exists cost_bdt;
delete from public.settings where key in ('limits.logo_checks_per_1000', 'checker.usd_to_bdt', 'checker.cost_lens_cents_per_1000', 'checker.cost_vision_cents_per_1000', 'checker.cost_ai_in_cents_per_m', 'checker.cost_ai_out_cents_per_m');

-- 0047: a client's checks per contest
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

notify pgrst, 'reload schema';

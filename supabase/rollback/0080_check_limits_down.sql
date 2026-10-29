-- Rollback of 0080: back to 15 checks for each full ৳1,000 of prize per contest, Pro 100 a month, the trial 10.
-- Run in Supabase → SQL Editor.

update public.settings set value = '20'::jsonb, description = 'AI logo checks per contest when the checker is free (prize at or over the free limit). Failed checks do not count.'
 where key = 'limits.logo_checks_per_contest';

-- The function as 0049 left it.
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
  v_per       int;
  v_paid      int;
  v_used      int;
begin
  select * into v_contest from public.contests where id = p_contest_id for update;
  if not found or v_contest.client_id <> p_user_id then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select * into v_check from public.logo_checks where request_key = p_request_key;
  if found then
    return v_check;
  end if;

  if v_contest.service <> 'logo' then
    raise exception 'locked' using errcode = 'P0001';
  end if;
  if v_contest.status not in ('open', 'judging', 'winner_selected', 'handover') then
    raise exception 'closed' using errcode = 'P0001';
  end if;

  v_per   := coalesce((select (value #>> '{}')::int from public.settings where key = 'limits.logo_checks_per_1000'), 15);
  v_paid  := coalesce((select (value #>> '{}')::int from public.settings where key = 'limits.logo_checks_paid'), 10);
  v_limit := greatest((v_contest.prize_amount / 1000) * v_per, case when v_contest.logo_scan then v_paid else 0 end);

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
  values (p_id, p_contest_id, p_entry_id, p_source, p_image_path, p_user_id, p_request_key, false, 0)
  returning * into v_check;
  return v_check;
end;
$$;
revoke execute on function public.start_logo_check(uuid, uuid, uuid, uuid, uuid, text, text) from public, anon, authenticated;

update public.pro_settings set pro_logo_checks = 100, trial_logo_checks = 10;
alter table public.pro_settings alter column pro_logo_checks set default 100;
alter table public.pro_settings alter column trial_logo_checks set default 10;

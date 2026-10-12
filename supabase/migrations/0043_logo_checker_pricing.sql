-- Logo checker pricing (owner, 2026-10-13; Design/logo-checker/LOGO-CHECKER-PAGE-HANDOFF.md).
-- Prize ৳5,000 or more: free, 20 logo checks per contest. Under ৳5,000: ৳250 add-on for 10 logo checks.
-- All four numbers stay in Settings. limits.logo_checks_per_contest is now the free number; the new
-- limits.logo_checks_paid is the add-on's number. The app checks the count too (src/lib/logo-check/start.ts).

-- 1. The numbers (the same values the admin can change in Admin → Settings).
update public.settings set value = '5000'::jsonb, description = 'Contests with this prize (taka) or more get the AI logo checker free.'
 where key = 'upgrades.logo_check_free_from';
update public.settings set value = '250'::jsonb, description = 'Price of the AI logo checker add-on for contests under the free prize (taka). It gives the paid number of checks (Limits).'
 where key = 'upgrades.logo_scan_price';
update public.settings set value = '20'::jsonb, description = 'AI logo checks per contest when the checker is free (prize at or over the free limit). Failed checks do not count.'
 where key = 'limits.logo_checks_per_contest';
insert into public.settings (key, value, type, "group", description) values
  ('limits.logo_checks_paid', '10'::jsonb, 'int', 'limits', 'AI logo checks the paid add-on gives a contest under the free prize. Failed checks do not count.')
on conflict (key) do nothing;

-- 2. Same as 0033 except: a paid contest gets limits.logo_checks_paid checks, a free one limits.logo_checks_per_contest.
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

-- Only the server calls it (create or replace keeps the old grants; repeated to be sure).
revoke execute on function public.start_logo_check(uuid, uuid, uuid, uuid, uuid, text, text) from public, anon, authenticated;

notify pgrst, 'reload schema';

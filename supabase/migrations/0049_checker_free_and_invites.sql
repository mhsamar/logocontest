-- Logo Image Checker free for every logo contest, its cost report, and Pro invitations with accept / decline
-- (owner, 2026-10-14). Down migration: supabase/rollback/0049_checker_free_and_invites_down.sql

-- 1. Checks per contest: 15 for each full ৳1,000 of prize, no ৳500 add-on. API prices for the cost report -----
insert into public.settings (key, value, type, "group", description) values
  ('limits.logo_checks_per_1000', '15'::jsonb, 'int', 'limits', 'Free AI logo checks a logo contest gets for each full ৳1,000 of prize (৳3,000 → 45). Failed checks do not count.'),
  ('checker.usd_to_bdt', '122'::jsonb, 'int', 'checker', 'Taka per US dollar, used to show the logo checker''s API cost in BDT.'),
  ('checker.cost_lens_cents_per_1000', '400'::jsonb, 'int', 'checker', 'Google Lens image search (SearchAPI): price in US cents per 1,000 searches.'),
  ('checker.cost_vision_cents_per_1000', '350'::jsonb, 'int', 'checker', 'Google Cloud Vision web detection: price in US cents per 1,000 images.'),
  ('checker.cost_ai_in_cents_per_m', '30'::jsonb, 'int', 'checker', 'AI model: price in US cents per 1 million input tokens.'),
  ('checker.cost_ai_out_cents_per_m', '250'::jsonb, 'int', 'checker', 'AI model: price in US cents per 1 million output tokens.')
on conflict (key) do nothing;

-- Each check keeps its cost in taka, at the rate of the day it ran.
alter table public.logo_checks add column if not exists cost_bdt numeric(10, 2);

-- 2. A client's checks: every logo contest, 15 per full ৳1,000 of prize (a contest that bought the old add-on keeps
--    at least the checks it paid for). Same as 0047 otherwise; other contest types can't use the checker.
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

-- 3. Invitations: the designer accepts or declines; an admin can take one back ----------------------------
alter table public.contest_invites add column if not exists status text not null default 'pending';
alter table public.contest_invites drop constraint if exists contest_invites_status_check;
alter table public.contest_invites add constraint contest_invites_status_check check (status in ('pending', 'accepted', 'declined', 'removed'));
alter table public.contest_invites add column if not exists responded_at timestamptz;
alter table public.contest_invites add column if not exists removed_by uuid references public.profiles (id) on delete set null;
alter table public.contest_invites add column if not exists removed_at timestamptz;
create index if not exists contest_invites_status_idx on public.contest_invites (status, created_at desc);

-- Declined and removed invitations don't count toward the invitations per contest.
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
  if (select count(*) from public.contest_invites where contest_id = new.contest_id and status in ('pending', 'accepted')) >= coalesce(v_max, 10) then
    raise exception 'too_many_invites' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';

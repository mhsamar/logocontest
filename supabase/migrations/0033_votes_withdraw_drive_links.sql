-- logocontest.bd - like and dislike on designs, designers remove their own design, Google Drive links for the
-- AI and EPS files, the copyright checker after a winner is picked (owner, 2026-10-11). Run after 0032.
-- Safe to re-run. Nothing is dropped.

-- 1. Like / dislike on designs ----------------------------------------------------------------------
-- One vote per person per design: 1 = like, -1 = dislike. The app checks who may vote on what
-- (designers on other people's designs; a client only on designs in their own contest).
create table if not exists public.entry_votes (
  entry_id    uuid not null references public.entries (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  vote        smallint not null check (vote in (-1, 1)),
  created_at  timestamptz not null default now(),
  primary key (entry_id, user_id)
);
create index if not exists entry_votes_entry_idx on public.entry_votes (entry_id);
-- Only the server (service role) reads and writes votes: row level security with no policies.
alter table public.entry_votes enable row level security;

-- 2. A designer removes their own design while the contest is open ---------------------------------
-- The design becomes 'withdrawn': hidden on the site for everyone, still visible to admins.
alter table public.entries add column if not exists withdrawn_at timestamptz;

-- 3. AI and EPS files as Google Drive links (big files stay off the site) ---------------------------
alter table public.handover_files add column if not exists link_url text;
alter table public.handover_files alter column path drop not null;
alter table public.handover_files alter column size_bytes drop not null;
do $$ begin
  alter table public.handover_files add constraint handover_files_link_url_check
    check (link_url is null or (char_length(link_url) <= 500 and link_url ~ '^https://(drive|docs)\.google\.com/'));
exception when duplicate_object then null; end $$;
-- Each row is either an uploaded file or a link, never both and never neither.
do $$ begin
  alter table public.handover_files add constraint handover_files_file_or_link
    check ((path is null) <> (link_url is null));
exception when duplicate_object then null; end $$;

-- 4. The copyright checker also works after a winner is picked --------------------------------------
-- (Owner, 2026-10-11: the "You picked a winner" pop-up offers the checker for the winning design.)
-- Same as 0031 except: the contest may also be 'winner_selected' or 'handover', and a withdrawn or
-- removed design can't be checked.
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

  v_limit     := coalesce((select (value #>> '{}')::int from public.settings where key = 'limits.logo_checks_per_contest'), 3);
  v_free_from := coalesce((select (value #>> '{}')::int from public.settings where key = 'upgrades.logo_check_free_from'), 8000);
  v_price     := coalesce((select (value #>> '{}')::int from public.settings where key = 'upgrades.logo_scan_price'), 500);
  v_free      := v_contest.prize_amount >= v_free_from;

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

-- Same as 0031 except: the checker add-on can also be bought after a winner is picked.
create or replace function public.confirm_addon_payment(p_payment_id uuid, p_amount int, p_gateway_txn_id text, p_raw jsonb)
returns public.contests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_contest public.contests;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'payment % not found', p_payment_id using errcode = 'no_data_found';
  end if;
  select * into v_contest from public.contests where id = v_payment.contest_id for update;

  if v_payment.status = 'paid' then
    return v_contest; -- duplicate callback
  end if;
  if v_payment.purpose::text not in ('addon', 'extension') then
    raise exception 'payment % is not an add-on payment', p_payment_id;
  end if;
  if p_amount <> v_payment.amount then
    raise exception 'amount mismatch for payment %', p_payment_id using errcode = 'check_violation';
  end if;
  if v_contest.status <> 'open'
     and not (v_payment.addon = 'logo_scan' and v_contest.status in ('judging', 'winner_selected', 'handover')) then
    raise exception 'contest % is not open', v_contest.id;
  end if;

  update public.payments
     set status = 'paid', paid_at = now(), gateway_txn_id = p_gateway_txn_id, raw_response = p_raw
   where id = p_payment_id;

  if v_payment.purpose::text = 'extension' then
    update public.contests
       set ends_at = ends_at + make_interval(days => v_payment.extension_days),
           extensions_count = extensions_count + 1,
           extension_days_total = extension_days_total + v_payment.extension_days
     where id = v_contest.id returning * into v_contest;
  elsif v_payment.addon = 'promote' then
    update public.contests set is_promoted = true where id = v_contest.id returning * into v_contest;
  elsif v_payment.addon = 'private' then
    update public.contests set is_private = true where id = v_contest.id returning * into v_contest;
  elsif v_payment.addon = 'blind' then
    update public.contests set is_blind = true where id = v_contest.id returning * into v_contest;
  elsif v_payment.addon = 'logo_scan' then
    update public.contests set logo_scan = true where id = v_contest.id returning * into v_contest;
  end if;

  return v_contest;
end;
$$;

-- Only the server calls these (create or replace keeps the old grants; repeated to be sure).
revoke execute on function public.start_logo_check(uuid, uuid, uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.confirm_addon_payment(uuid, int, text, jsonb) from public, anon, authenticated;

notify pgrst, 'reload schema';

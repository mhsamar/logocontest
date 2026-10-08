-- logocontest.bd — add-ons after launch, Logo Scan and picking the winner (owner, 2026-10-08; BLUEPRINT.md §5, §7.4).
-- Run after 0013 in Supabase → SQL Editor. Safe to re-run.

alter type public.payment_purpose add value if not exists 'addon';

-- Which add-on a payment buys (purpose = 'addon'). Extensions keep using purpose = 'extension'.
alter table public.payments add column if not exists addon text
  check (addon is null or addon in ('promote', 'private', 'blind', 'logo_scan'));

-- Logo Scan bought for this contest: every design in it can be scanned.
alter table public.contests add column if not exists logo_scan boolean not null default false;

-- Results of a scan of one design.
create table if not exists public.logo_scans (
  id               uuid primary key default gen_random_uuid(),
  entry_id         uuid not null references public.entries (id) on delete cascade,
  requested_by     uuid not null references public.profiles (id) on delete cascade,
  driver           text not null,
  full_matches     jsonb not null default '[]'::jsonb,
  partial_matches  jsonb not null default '[]'::jsonb,
  similar_images   jsonb not null default '[]'::jsonb,
  pages            jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists logo_scans_entry_idx on public.logo_scans (entry_id, created_at desc);
alter table public.logo_scans enable row level security;

-- A paid add-on or extension, applied in one transaction. Idempotent: a second callback does nothing.
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
  if v_contest.status <> 'open' then
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

create or replace function public.fail_addon_payment(p_payment_id uuid, p_raw jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.payments set status = 'failed', raw_response = p_raw
   where id = p_payment_id and status = 'initiated' and purpose::text in ('addon', 'extension');
end;
$$;

-- The client picks a winner (open or judging). The contest closes at once.
create or replace function public.pick_winner(p_contest_id uuid, p_entry_id uuid)
returns public.contests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contest public.contests;
  v_entry public.entries;
begin
  select * into v_contest from public.contests where id = p_contest_id for update;
  if not found then
    raise exception 'contest % not found', p_contest_id using errcode = 'no_data_found';
  end if;
  if v_contest.status not in ('open', 'judging') then
    raise exception 'contest % cannot pick a winner now', p_contest_id;
  end if;
  select * into v_entry from public.entries where id = p_entry_id and contest_id = p_contest_id for update;
  if not found or v_entry.status <> 'active' then
    raise exception 'entry % cannot win', p_entry_id;
  end if;

  update public.entries set status = 'winner' where id = p_entry_id;
  update public.contests
     set status = 'winner_selected',
         winner_entry_id = p_entry_id,
         ends_at = least(coalesce(ends_at, now()), now())
   where id = p_contest_id
  returning * into v_contest;
  return v_contest;
end;
$$;

revoke all on function public.confirm_addon_payment(uuid, int, text, jsonb) from public, anon, authenticated;
revoke all on function public.fail_addon_payment(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.pick_winner(uuid, uuid) from public, anon, authenticated;

-- Owner, 2026-10-08: Logo Scan costs ৳500 per contest.
insert into public.settings (key, value, type, "group", description)
values ('upgrades.logo_scan_price', '500'::jsonb, 'int', 'upgrades', 'Price of the Logo Scan add-on (taka, once per contest).')
on conflict (key) do nothing;

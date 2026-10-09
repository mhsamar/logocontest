-- logocontest.bd — file handover and the designer wallet (owner, 2026-10-08; BLUEPRINT.md §6, §7.2, §7.3, §9.3).
-- Run after 0020 in Supabase → SQL Editor. Safe to re-run.
--
-- Money rules: the wallet is a ledger (wallet_transactions); balance = the latest balance_after.
-- Every function that changes money locks the designer's profile row first.

-- ---------------------------------------------------------------------------
-- Handovers
-- ---------------------------------------------------------------------------
create table if not exists public.handovers (
  id                     uuid primary key default gen_random_uuid(),
  contest_id             uuid not null references public.contests (id) on delete cascade,
  entry_id               uuid not null references public.entries (id) on delete cascade,
  designer_id            uuid not null references public.profiles (id) on delete cascade,
  status                 text not null default 'awaiting_files'
                         check (status in ('awaiting_files', 'submitted', 'revision_requested', 'approved', 'cancelled', 'no_result')),
  prize                  int not null check (prize >= 0),
  fee_rate               int not null check (fee_rate between 0 and 100), -- locked when the winner is picked
  counts_as_win          boolean not null default false,                   -- set when approved
  revision_count         int not null default 0,
  revision_note          text check (revision_note is null or char_length(revision_note) <= 1000),
  fonts_note             text check (fonts_note is null or char_length(fonts_note) <= 500),
  agreement_accepted_at  timestamptz,
  due_at                 timestamptz not null,
  submitted_at           timestamptz,
  review_due_at          timestamptz,
  approved_at            timestamptz,
  client_rating          int check (client_rating between 1 and 5),
  client_feedback        text check (client_feedback is null or char_length(client_feedback) <= 1500),
  created_at             timestamptz not null default now()
);
-- One live handover per contest (a cancelled one can be followed by a new winner's).
create unique index if not exists handovers_one_live_per_contest on public.handovers (contest_id) where status <> 'cancelled';
create index if not exists handovers_designer_idx on public.handovers (designer_id, created_at desc);
alter table public.handovers enable row level security;

create table if not exists public.handover_files (
  id             uuid primary key default gen_random_uuid(),
  handover_id    uuid not null references public.handovers (id) on delete cascade,
  file_type      text not null check (file_type in ('ai', 'eps', 'svg', 'pdf', 'png', 'jpg', 'extra')),
  path           text not null,
  original_name  text not null check (char_length(original_name) <= 200),
  size_bytes     bigint not null check (size_bytes > 0),
  created_at     timestamptz not null default now()
);
-- One file per required type; extras can be several.
create unique index if not exists handover_files_one_per_type on public.handover_files (handover_id, file_type) where file_type <> 'extra';
alter table public.handover_files enable row level security;

-- ---------------------------------------------------------------------------
-- Wallet ledger and withdrawals
-- ---------------------------------------------------------------------------
create table if not exists public.wallet_transactions (
  id             uuid primary key default gen_random_uuid(),
  seq            bigint generated always as identity,
  designer_id    uuid not null references public.profiles (id) on delete cascade,
  type           text not null check (type in ('prize_credit', 'split_share', 'withdrawal', 'adjustment', 'bonus')),
  amount         int not null,                 -- signed: credits positive, withdrawals negative
  contest_id     uuid references public.contests (id) on delete set null,
  withdrawal_id  uuid,
  fee_rate       int,
  fee_amount     int,
  balance_after  int not null check (balance_after >= 0),
  note           text,
  created_at     timestamptz not null default now()
);
create index if not exists wallet_transactions_designer_idx on public.wallet_transactions (designer_id, seq desc);
alter table public.wallet_transactions enable row level security;

create table if not exists public.withdrawals (
  id                uuid primary key default gen_random_uuid(),
  designer_id       uuid not null references public.profiles (id) on delete cascade,
  payout_method_id  uuid references public.designer_payout_methods (id) on delete set null,
  method_type       text not null check (method_type in ('bkash', 'bank')),
  destination       jsonb not null,            -- copy of the payout details at request time
  amount            int not null check (amount > 0),
  status            text not null default 'requested' check (status in ('requested', 'paid', 'rejected')),
  gateway           text,
  paid_txn_id       text,
  reject_reason     text,
  processed_by      uuid references public.profiles (id) on delete set null,
  processed_at      timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists withdrawals_designer_idx on public.withdrawals (designer_id, created_at desc);
create index if not exists withdrawals_requested_idx on public.withdrawals (created_at) where status = 'requested';
alter table public.withdrawals enable row level security;

-- Latest balance of a designer (0 when they have no transactions yet).
create or replace function public.wallet_balance(p_designer_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select balance_after from public.wallet_transactions where designer_id = p_designer_id order by seq desc limit 1), 0);
$$;

-- ---------------------------------------------------------------------------
-- Picking the winner now also opens the handover with the fee rate locked (§7.2).
-- ---------------------------------------------------------------------------
drop function if exists public.pick_winner(uuid, uuid);

create or replace function public.pick_winner(p_contest_id uuid, p_entry_id uuid, p_fee_rate int, p_due_at timestamptz)
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

  insert into public.handovers (contest_id, entry_id, designer_id, prize, fee_rate, due_at)
  values (p_contest_id, p_entry_id, v_entry.designer_id, v_contest.prize_amount, p_fee_rate, p_due_at);

  return v_contest;
end;
$$;

-- The winner sends the files: all six types must be there (§9.3).
create or replace function public.submit_handover(p_handover_id uuid, p_designer_id uuid, p_fonts_note text, p_review_days int)
returns public.handovers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_h public.handovers;
  v_types int;
begin
  select * into v_h from public.handovers where id = p_handover_id for update;
  if not found or v_h.designer_id <> p_designer_id then
    raise exception 'handover % not found', p_handover_id using errcode = 'no_data_found';
  end if;
  if v_h.status not in ('awaiting_files', 'revision_requested') then
    raise exception 'handover % cannot be submitted now', p_handover_id;
  end if;
  select count(distinct file_type) into v_types from public.handover_files
   where handover_id = p_handover_id and file_type in ('ai', 'eps', 'svg', 'pdf', 'png', 'jpg');
  if v_types < 6 then
    raise exception 'handover % is missing files', p_handover_id using errcode = 'check_violation';
  end if;

  update public.handovers
     set status = 'submitted',
         fonts_note = nullif(trim(p_fonts_note), ''),
         agreement_accepted_at = coalesce(agreement_accepted_at, now()),
         submitted_at = now(),
         review_due_at = now() + make_interval(days => p_review_days)
   where id = p_handover_id
  returning * into v_h;
  update public.contests set status = 'handover' where id = v_h.contest_id and status = 'winner_selected';
  return v_h;
end;
$$;

-- The client asks for a change (up to p_max times).
create or replace function public.request_handover_revision(p_handover_id uuid, p_client_id uuid, p_note text, p_max int)
returns public.handovers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_h public.handovers;
  v_client uuid;
begin
  select * into v_h from public.handovers where id = p_handover_id for update;
  select client_id into v_client from public.contests where id = v_h.contest_id;
  if not found or v_client is distinct from p_client_id then
    raise exception 'handover % not found', p_handover_id using errcode = 'no_data_found';
  end if;
  if v_h.status <> 'submitted' or v_h.revision_count >= p_max then
    raise exception 'handover % cannot be sent back now', p_handover_id;
  end if;
  update public.handovers
     set status = 'revision_requested', revision_count = revision_count + 1, revision_note = p_note, review_due_at = null
   where id = p_handover_id
  returning * into v_h;
  return v_h;
end;
$$;

-- The client approves: the contest is completed, the win is counted and the designer is paid (§7.2, §7.3).
create or replace function public.approve_handover(
  p_handover_id uuid,
  p_client_id uuid,
  p_rating int,
  p_feedback text,
  p_min_prize int,
  p_min_designers int,
  p_max_per_client int
)
returns public.wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_h public.handovers;
  v_contest public.contests;
  v_designers int;
  v_client_wins int;
  v_counts boolean;
  v_fee int;
  v_credit int;
  v_balance int;
  v_tx public.wallet_transactions;
begin
  select * into v_h from public.handovers where id = p_handover_id for update;
  if not found then
    raise exception 'handover % not found', p_handover_id using errcode = 'no_data_found';
  end if;
  select * into v_contest from public.contests where id = v_h.contest_id for update;
  if v_contest.client_id <> p_client_id then
    raise exception 'handover % not found', p_handover_id using errcode = 'no_data_found';
  end if;
  if v_h.status <> 'submitted' then
    raise exception 'handover % cannot be approved now', p_handover_id;
  end if;
  if p_rating not between 1 and 5 then
    raise exception 'rating must be 1 to 5' using errcode = 'check_violation';
  end if;

  -- Lock the designer before touching their money and counts.
  perform 1 from public.profiles where id = v_h.designer_id for update;

  -- A win counts toward tiers and the leaderboard: prize ≥ minimum, enough designers, at most N counted wins from this client.
  select count(distinct designer_id) into v_designers from public.entries
   where contest_id = v_h.contest_id and status in ('active', 'winner', 'forfeited', 'rejected');
  select count(*) into v_client_wins from public.handovers h join public.contests c on c.id = h.contest_id
   where c.client_id = v_contest.client_id and h.designer_id = v_h.designer_id and h.counts_as_win;
  v_counts := v_h.prize >= p_min_prize and v_designers >= p_min_designers and v_client_wins < p_max_per_client;

  v_fee := round(v_h.prize * v_h.fee_rate / 100.0);
  v_credit := v_h.prize - v_fee;
  v_balance := public.wallet_balance(v_h.designer_id) + v_credit;

  update public.handovers
     set status = 'approved', approved_at = now(), client_rating = p_rating, client_feedback = p_feedback, counts_as_win = v_counts
   where id = p_handover_id;
  update public.contests set status = 'completed', completed_at = now() where id = v_h.contest_id;
  update public.profiles
     set wins_count = wins_count + 1,
         counted_wins_count = counted_wins_count + case when v_counts then 1 else 0 end
   where id = v_h.designer_id;

  insert into public.wallet_transactions (designer_id, type, amount, contest_id, fee_rate, fee_amount, balance_after, note)
  values (v_h.designer_id, 'prize_credit', v_credit, v_h.contest_id, v_h.fee_rate, v_fee, v_balance, null)
  returning * into v_tx;
  return v_tx;
end;
$$;

-- A designer asks to withdraw: the balance goes down at once (§7.3).
create or replace function public.request_withdrawal(p_designer_id uuid, p_amount int, p_payout_method_id uuid, p_min int)
returns public.withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_method public.designer_payout_methods;
  v_balance int;
  v_w public.withdrawals;
begin
  perform 1 from public.profiles where id = p_designer_id for update;
  select * into v_method from public.designer_payout_methods where id = p_payout_method_id and user_id = p_designer_id;
  if not found then
    raise exception 'payout method not found' using errcode = 'no_data_found';
  end if;
  v_balance := public.wallet_balance(p_designer_id);
  if p_amount < p_min or p_amount > v_balance then
    raise exception 'amount not allowed' using errcode = 'check_violation';
  end if;

  insert into public.withdrawals (designer_id, payout_method_id, method_type, destination, amount)
  values (
    p_designer_id, v_method.id, v_method.type,
    jsonb_strip_nulls(jsonb_build_object(
      'bkash_number', v_method.bkash_number, 'bank_name', v_method.bank_name, 'branch', v_method.branch,
      'account_name', v_method.account_name, 'account_number', v_method.account_number, 'routing_number', v_method.routing_number)),
    p_amount)
  returning * into v_w;

  insert into public.wallet_transactions (designer_id, type, amount, withdrawal_id, balance_after, note)
  values (p_designer_id, 'withdrawal', -p_amount, v_w.id, v_balance - p_amount, v_method.type);
  return v_w;
end;
$$;

-- The money was sent (automatically or by an admin).
create or replace function public.mark_withdrawal_paid(p_withdrawal_id uuid, p_txn_id text, p_gateway text, p_by uuid)
returns public.withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_w public.withdrawals;
begin
  update public.withdrawals
     set status = 'paid', paid_txn_id = p_txn_id, gateway = p_gateway, processed_by = p_by, processed_at = now()
   where id = p_withdrawal_id and status = 'requested'
  returning * into v_w;
  if not found then
    raise exception 'withdrawal % is not waiting', p_withdrawal_id;
  end if;
  return v_w;
end;
$$;

-- An admin rejects a withdrawal: the amount goes back to the wallet.
create or replace function public.reject_withdrawal(p_withdrawal_id uuid, p_reason text, p_by uuid)
returns public.withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_w public.withdrawals;
begin
  select * into v_w from public.withdrawals where id = p_withdrawal_id for update;
  if not found or v_w.status <> 'requested' then
    raise exception 'withdrawal % is not waiting', p_withdrawal_id;
  end if;
  perform 1 from public.profiles where id = v_w.designer_id for update;
  update public.withdrawals
     set status = 'rejected', reject_reason = p_reason, processed_by = p_by, processed_at = now()
   where id = p_withdrawal_id
  returning * into v_w;
  insert into public.wallet_transactions (designer_id, type, amount, withdrawal_id, balance_after, note)
  values (v_w.designer_id, 'adjustment', v_w.amount, v_w.id, public.wallet_balance(v_w.designer_id) + v_w.amount, 'withdrawal_returned');
  return v_w;
end;
$$;

revoke all on function public.wallet_balance(uuid) from public, anon, authenticated;
revoke all on function public.pick_winner(uuid, uuid, int, timestamptz) from public, anon, authenticated;
revoke all on function public.submit_handover(uuid, uuid, text, int) from public, anon, authenticated;
revoke all on function public.request_handover_revision(uuid, uuid, text, int) from public, anon, authenticated;
revoke all on function public.approve_handover(uuid, uuid, int, text, int, int, int) from public, anon, authenticated;
revoke all on function public.request_withdrawal(uuid, int, uuid, int) from public, anon, authenticated;
revoke all on function public.mark_withdrawal_paid(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.reject_withdrawal(uuid, text, uuid) from public, anon, authenticated;

-- Largest handover file (MB).
insert into public.settings (key, value, type, "group", description) values
  ('limits.handover_file_max_mb', '50'::jsonb, 'int', 'limits', 'Largest final file the winner can upload (MB).')
on conflict (key) do nothing;

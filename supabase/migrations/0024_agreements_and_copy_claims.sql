-- logocontest.bd — designer originality agreement, copy claims and the payout hold
-- (owner, 2026-10-09; BLUEPRINT.md §2, §5, §7.3, §7.6, §9.6).
-- Run after 0023 in Supabase → SQL Editor. Safe to re-run. No function signature changes, nothing dropped.

-- One signed agreement per designer, before their first design (§9.6). Server and admins only.
create table if not exists public.designer_agreements (
  designer_id     uuid primary key references public.profiles (id) on delete cascade,
  full_name       text not null check (char_length(full_name) between 3 and 80),
  mobile          text not null check (char_length(mobile) between 11 and 14),
  address         text not null check (char_length(address) between 10 and 300),
  id_type         text not null check (id_type in ('nid', 'passport', 'birth_certificate')),
  id_number       text not null check (id_number ~ '^[A-Z0-9]{6,17}$'),
  signature_name  text not null check (char_length(signature_name) between 3 and 80),
  version         text not null check (char_length(version) <= 20),
  signed_at       timestamptz not null default now(),
  signed_ip       text,
  user_agent      text check (user_agent is null or char_length(user_agent) <= 400)
);
alter table public.designer_agreements enable row level security;

-- Admin actions worth a record (BLUEPRINT §5, §13.12). Starts with ID-number reveals and claim decisions.
create table if not exists public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  admin_id      uuid references public.profiles (id) on delete set null,
  action        text not null check (char_length(action) <= 60),
  subject_type  text not null check (char_length(subject_type) <= 40),
  subject_id    text,
  changes       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
alter table public.audit_logs enable row level security;

-- Copy claims on the winning design (§7.6).
create table if not exists public.copy_claims (
  id             uuid primary key default gen_random_uuid(),
  contest_id     uuid not null references public.contests (id) on delete cascade,
  handover_id    uuid not null references public.handovers (id) on delete cascade,
  entry_id       uuid not null references public.entries (id) on delete cascade,
  client_id      uuid not null references public.profiles (id) on delete cascade,
  designer_id    uuid not null references public.profiles (id) on delete cascade,
  note           text not null check (char_length(note) between 20 and 1000),
  evidence_urls  jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_urls) = 'array' and jsonb_array_length(evidence_urls) <= 5),
  status         text not null default 'open' check (status in ('open', 'upheld', 'rejected')),
  outcome        text check (outcome is null or outcome in ('correction', 'fine', 'ban')),
  fine_amount    int check (fine_amount is null or fine_amount >= 0),
  admin_note     text check (admin_note is null or char_length(admin_note) <= 1000),
  resolved_by    uuid references public.profiles (id) on delete set null,
  resolved_at    timestamptz,
  created_at     timestamptz not null default now()
);
create unique index if not exists copy_claims_one_open on public.copy_claims (handover_id) where status = 'open';
create index if not exists copy_claims_open_idx on public.copy_claims (created_at) where status = 'open';
alter table public.copy_claims enable row level security;

-- When the prize reached the wallet (§7.3). Prizes already paid keep their approval time.
alter table public.handovers add column if not exists credited_at timestamptz;
update public.handovers set credited_at = approved_at where status = 'approved' and credited_at is null;

insert into public.settings (key, value, type, "group", description) values
  ('timers.copy_claim_days', '3'::jsonb, 'int', 'timers', 'Days after the winner is picked when the client can claim the design is copied. The prize is held until they pass.')
on conflict (key) do nothing;

-- Credit an approved prize once the copy-claim days are over and no claim is open (§7.3). Safe to call again.
create or replace function public.release_prize_credit(p_handover_id uuid)
returns public.wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_h public.handovers;
  v_days int;
  v_fee int;
  v_credit int;
  v_tx public.wallet_transactions;
begin
  select * into v_h from public.handovers where id = p_handover_id for update;
  if not found or v_h.status <> 'approved' or v_h.credited_at is not null then
    return null;
  end if;
  select coalesce((value #>> '{}')::int, 3) into v_days from public.settings where key = 'timers.copy_claim_days';
  if v_h.created_at + make_interval(days => coalesce(v_days, 3)) > now() then
    return null; -- still in the hold
  end if;
  if exists (select 1 from public.copy_claims where handover_id = p_handover_id and status = 'open') then
    return null; -- frozen while a claim is open
  end if;

  perform 1 from public.profiles where id = v_h.designer_id for update;
  v_fee := round(v_h.prize * v_h.fee_rate / 100.0);
  v_credit := v_h.prize - v_fee;
  insert into public.wallet_transactions (designer_id, type, amount, contest_id, fee_rate, fee_amount, balance_after, note)
  values (v_h.designer_id, 'prize_credit', v_credit, v_h.contest_id, v_h.fee_rate, v_fee, public.wallet_balance(v_h.designer_id) + v_credit, null)
  returning * into v_tx;
  update public.handovers set credited_at = now() where id = p_handover_id;
  return v_tx;
end;
$$;

-- The client approves (C-17). Same as 0021, except the prize is credited only when the hold is over (§7.3);
-- returns the wallet transaction, or null while the prize is held.
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

  perform 1 from public.profiles where id = v_h.designer_id for update;

  select count(distinct designer_id) into v_designers from public.entries
   where contest_id = v_h.contest_id and status in ('active', 'winner', 'forfeited', 'rejected');
  select count(*) into v_client_wins from public.handovers h join public.contests c on c.id = h.contest_id
   where c.client_id = v_contest.client_id and h.designer_id = v_h.designer_id and h.counts_as_win;
  v_counts := v_h.prize >= p_min_prize and v_designers >= p_min_designers and v_client_wins < p_max_per_client;

  update public.handovers
     set status = 'approved', approved_at = now(), client_rating = p_rating, client_feedback = p_feedback, counts_as_win = v_counts
   where id = p_handover_id;
  update public.contests set status = 'completed', completed_at = now() where id = v_h.contest_id;
  update public.profiles
     set wins_count = wins_count + 1,
         counted_wins_count = counted_wins_count + case when v_counts then 1 else 0 end
   where id = v_h.designer_id;

  return public.release_prize_credit(p_handover_id);
end;
$$;

-- An admin decides a copy claim (§7.6): 'rejected', or upheld with 'correction', 'fine' or 'ban'.
create or replace function public.resolve_copy_claim(
  p_claim_id uuid,
  p_admin_id uuid,
  p_decision text,
  p_fine int,
  p_note text,
  p_upload_days int,
  p_repick_days int
)
returns public.copy_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.copy_claims;
  v_h public.handovers;
  v_live boolean;
  v_fine int := null;
  v_balance int;
begin
  select * into v_claim from public.copy_claims where id = p_claim_id for update;
  if not found or v_claim.status <> 'open' then
    raise exception 'claim % is not open', p_claim_id;
  end if;
  if p_decision not in ('rejected', 'correction', 'fine', 'ban') then
    raise exception 'unknown decision %', p_decision using errcode = 'check_violation';
  end if;

  if p_decision = 'rejected' then
    update public.copy_claims
       set status = 'rejected', admin_note = p_note, resolved_by = p_admin_id, resolved_at = now()
     where id = p_claim_id
    returning * into v_claim;
    return v_claim;
  end if;

  select * into v_h from public.handovers where id = v_claim.handover_id for update;
  perform 1 from public.contests where id = v_claim.contest_id for update;
  perform 1 from public.profiles where id = v_claim.designer_id for update;
  if v_h.credited_at is not null then
    raise exception 'prize for handover % was already paid', v_h.id;
  end if;
  v_live := v_h.status not in ('cancelled', 'no_result');

  -- An approved win is undone first (counts back down); the prize was never credited while the claim was open.
  if v_h.status = 'approved' then
    update public.profiles
       set wins_count = greatest(wins_count - 1, 0),
           counted_wins_count = greatest(counted_wins_count - case when v_h.counts_as_win then 1 else 0 end, 0)
     where id = v_claim.designer_id;
  end if;

  if p_decision = 'correction' then
    if v_live then
      update public.handovers
         set status = 'revision_requested', approved_at = null, counts_as_win = false, client_rating = null, client_feedback = null,
             review_due_at = null, revision_note = p_note, due_at = now() + make_interval(days => p_upload_days)
       where id = v_h.id;
      update public.contests set status = 'handover', completed_at = null where id = v_claim.contest_id;
    end if;
  else
    if v_live then
      update public.handovers set status = 'cancelled', counts_as_win = false where id = v_h.id;
      update public.contests
         set status = 'judging', winner_entry_id = null, completed_at = null, judging_ends_at = now() + make_interval(days => p_repick_days)
       where id = v_claim.contest_id;
    end if;
    -- The designer's designs in this contest are removed, so they can't win again or share a no-result prize.
    update public.entries set status = 'removed'
     where contest_id = v_claim.contest_id and designer_id = v_claim.designer_id and status in ('active', 'winner');

    if p_decision = 'fine' then
      v_balance := public.wallet_balance(v_claim.designer_id);
      v_fine := least(greatest(coalesce(p_fine, 0), 0), v_balance);
      if v_fine > 0 then
        insert into public.wallet_transactions (designer_id, type, amount, contest_id, balance_after, note)
        values (v_claim.designer_id, 'adjustment', -v_fine, v_claim.contest_id, v_balance - v_fine, 'copy_claim_fine');
      end if;
    else
      update public.profiles set status = 'banned' where id = v_claim.designer_id;
    end if;
  end if;

  update public.copy_claims
     set status = 'upheld', outcome = p_decision, fine_amount = v_fine, admin_note = p_note, resolved_by = p_admin_id, resolved_at = now()
   where id = p_claim_id
  returning * into v_claim;
  return v_claim;
end;
$$;

revoke all on function public.release_prize_credit(uuid) from public, anon, authenticated;
revoke all on function public.approve_handover(uuid, uuid, int, text, int, int, int) from public, anon, authenticated;
revoke all on function public.resolve_copy_claim(uuid, uuid, text, int, text, int, int) from public, anon, authenticated;

notify pgrst, 'reload schema';

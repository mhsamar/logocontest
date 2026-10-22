-- 0069 Money-back guarantee (owner, 2026-10-21; BLUEPRINT §7.10). If a contest ends with designs from fewer than
-- 3 different designers, its client can claim back everything they paid for it. The promise is stamped on the contest
-- when the client goes to pay (or when it opens), only while Settings › guarantee.enabled is on, so turning it off
-- later never takes it away. One claim per contest; while it waits, the contest is frozen (no pick, no split, no
-- cancel). An admin approves (the contest is cancelled, nobody gets a share) or rejects (the client gets more days to
-- pick). The money goes back by hand: bKash TrxID or Stripe refund id pasted on Admin › Money-back claims.
-- Run in Supabase → SQL Editor, ONE BLOCK AT A TIME, in order. Every block is safe to re-run.

-- ---- Block 1: settings and the per-contest promise -------------------------------------------------------------
insert into public.settings (key, value, type, "group", description) values
  ('guarantee.enabled', 'false'::jsonb, 'bool', 'payments', 'Money-back guarantee on. Contests paid while it is on keep it, even if it is turned off later.'),
  ('guarantee.min_designers', '3'::jsonb, 'int', 'payments', 'Different designers a contest needs. With fewer, the client can claim back everything they paid.'),
  ('guarantee.late_days', '30'::jsonb, 'int', 'payments', 'Days after a no-result end (when nobody got a share) during which the client can still claim.')
on conflict (key) do nothing;
alter table public.contests add column if not exists guarantee_designers smallint
  check (guarantee_designers is null or guarantee_designers between 1 and 50);
-- Check: select key, value from public.settings where key like 'guarantee.%';   → 3 rows

-- ---- Block 2: stamp the promise when the client goes to pay, or when the contest opens ----------------------------
create or replace function public.guarantee_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.guarantee_designers is null
     and coalesce((select (value #>> '{}')::boolean from public.settings where key = 'guarantee.enabled'), false) then
    new.guarantee_designers := coalesce((select (value #>> '{}')::int from public.settings where key = 'guarantee.min_designers'), 3);
  end if;
  return new;
end; $$;
drop trigger if exists contests_guarantee_stamp on public.contests;
create trigger contests_guarantee_stamp before update of status on public.contests
  for each row when (old.status in ('draft', 'pending_payment') and new.status in ('pending_payment', 'open'))
  execute function public.guarantee_stamp();

-- ---- Block 3: the claims (only the server reads them: RLS on, no policy) -----------------------------------------
-- The contest and client links become empty if the Trash ever erases them, so the refund record stays.
create table if not exists public.guarantee_claims (
  id                     uuid primary key default gen_random_uuid(),
  contest_id             uuid unique references public.contests (id) on delete set null,
  client_id              uuid references public.profiles (id) on delete set null,
  contest_number         int,
  brand_name             text not null default '',
  status                 text not null default 'pending' check (status in ('pending', 'approved', 'refunded', 'rejected')),
  late                   boolean not null default false,   -- claimed after a no-result end where nobody got a share
  disputed               boolean not null default false,   -- "please check the count": enough designers were counted
  min_designers          smallint not null,
  designers_at_claim     int not null,
  designer_ids_at_claim  uuid[] not null default '{}',
  designers_at_decision  int,
  excluded               jsonb not null default '[]'::jsonb,  -- [{designer_id, reason}] left out of the count at approval
  amount                 int not null check (amount >= 0),     -- taka, every paid payment of the contest
  usd_cents              int not null default 0 check (usd_cents >= 0),
  fee_amount             int not null default 0,               -- of it, the service fee: for the reports
  extras_amount          int not null default 0,               -- of it, upgrades, add-ons and extensions
  payments               jsonb not null default '[]'::jsonb,   -- the paid lines when claimed / approved
  refund_to              text check (refund_to is null or refund_to ~ '^\+8801[3-9][0-9]{8}$'),
  client_note            text check (client_note is null or char_length(client_note) <= 500),
  reply                  text check (reply is null or char_length(reply) <= 500),            -- shown to the client
  internal_note          text check (internal_note is null or char_length(internal_note) <= 1000), -- staff only
  decided_by             uuid references public.profiles (id) on delete set null,
  decided_at             timestamptz,
  paying_by              uuid references public.profiles (id) on delete set null,
  paying_since           timestamptz,
  refund_refs            jsonb not null default '{}'::jsonb,   -- refund route → bKash TrxID or Stripe re_… id
  refund_ref             text check (refund_ref is null or char_length(refund_ref) <= 400),
  refunded_by            uuid references public.profiles (id) on delete set null,
  refunded_at            timestamptz,
  created_at             timestamptz not null default now()
);
create index if not exists guarantee_claims_status_idx on public.guarantee_claims (status, created_at);
create index if not exists guarantee_claims_client_idx on public.guarantee_claims (client_id, created_at desc);
alter table public.guarantee_claims enable row level security;
-- Check: select count(*) from public.guarantee_claims;   → 0

-- ---- Block 4: who counts, and what was paid ---------------------------------------------------------------------
-- Counted: designers with a design that is active, rejected, a winner or forfeited, plus a design the client
-- rejected and its designer then took back. Held designs (waiting for the team) count only when the team decides
-- (p_with_held). Test designers are left out only in a test client's contest. Keep in step with rules.ts.
create or replace function public.guarantee_designer_ids(p_contest_id uuid, p_with_held boolean) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct e.designer_id), '{}'::uuid[])
    from public.entries e
    join public.profiles p on p.id = e.designer_id
    join public.contests c on c.id = e.contest_id
    join public.profiles cl on cl.id = c.client_id
   where e.contest_id = p_contest_id
     and (e.status in ('active', 'rejected', 'winner', 'forfeited')
          or (p_with_held and e.status = 'held')
          or (e.status = 'withdrawn' and e.rejected_at is not null))
     and not (p.is_test and cl.is_test);
$$;
create or replace function public.guarantee_paid(p_contest_id uuid, out amount int, out usd_cents int, out fee int, out extras int, out lines jsonb)
language sql stable security definer set search_path = public as $$
  select coalesce(sum(p.amount), 0)::int,
         coalesce(sum(p.charged_cents) filter (where p.currency = 'USD'), 0)::int,
         coalesce(max(c.service_fee_amount) filter (where p.purpose = 'contest'), 0)::int,
         (coalesce(sum(p.amount) filter (where p.purpose <> 'contest'), 0) + coalesce(max(c.upgrades_amount) filter (where p.purpose = 'contest'), 0))::int,
         coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'purpose', p.purpose, 'gateway', p.gateway, 'method', p.method, 'currency', p.currency,
           'amount', p.amount, 'cents', p.charged_cents, 'txn', p.gateway_txn_id, 'paid_at', p.paid_at,
           'intent', coalesce(nullif(p.raw_response ->> 'stripe_payment_intent', ''), case when p.gateway_txn_id like 'pi\_%' then p.gateway_txn_id end),
           'sender', (select m.sender_number from public.manual_payments m where m.payment_id = p.id and m.status = 'approved' limit 1),
           'qa', coalesce(p.raw_response ->> 'qa', '') = '1' or p.gateway = 'fake'
         ) order by p.paid_at), '[]'::jsonb)
    from public.payments p join public.contests c on c.id = p.contest_id
   where p.contest_id = p_contest_id and p.status = 'paid';
$$;
revoke all on function public.guarantee_designer_ids(uuid, boolean) from public, anon, authenticated;
revoke all on function public.guarantee_paid(uuid) from public, anon, authenticated;
-- Check: select public.guarantee_designer_ids(id, false) from public.contests limit 1;   → a list (maybe {})

-- ---- Block 5: freeze a contest while its claim waits ------------------------------------------------------------
create or replace function public.guarantee_freeze() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.guarantee_claims where contest_id = old.id and status = 'pending') then
    raise exception 'guarantee:frozen' using errcode = 'check_violation';
  end if;
  return new;
end; $$;
drop trigger if exists contests_guarantee_freeze on public.contests;
create trigger contests_guarantee_freeze before update of status on public.contests
  for each row when (old.status is distinct from new.status) execute function public.guarantee_freeze();
-- Check: select tgname from pg_trigger where tgrelid = 'public.contests'::regclass and tgname like 'contests_guarantee%';   → 2 rows

-- ---- Block 6: the client's claim --------------------------------------------------------------------------------
create or replace function public.open_guarantee_claim(p_contest_id uuid, p_client_id uuid, p_refund_to text, p_note text, p_disputed boolean)
returns public.guarantee_claims language plpgsql security definer set search_path = public as $$
declare
  v_c public.contests; v_ids uuid[]; v_paid record; v_claim public.guarantee_claims; v_late boolean;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_late_days int := coalesce((select (value #>> '{}')::int from public.settings where key = 'guarantee.late_days'), 30);
begin
  select * into v_c from public.contests where id = p_contest_id for update;
  if not found or v_c.client_id is distinct from p_client_id then raise exception 'guarantee:not_found' using errcode = 'no_data_found'; end if;
  if v_c.guarantee_designers is null then raise exception 'guarantee:none'; end if;
  if exists (select 1 from public.guarantee_claims where contest_id = v_c.id) then raise exception 'guarantee:already'; end if;
  if exists (select 1 from public.handovers where contest_id = v_c.id) then raise exception 'guarantee:winner'; end if;
  if not exists (select 1 from public.payments where contest_id = v_c.id and purpose = 'contest' and status = 'paid') then raise exception 'guarantee:not_paid'; end if;
  if v_c.status = 'judging' and v_c.judging_ends_at > now() then
    v_late := false;
  elsif v_c.status = 'no_result' and v_c.admin_review and v_c.completed_at > now() - make_interval(days => v_late_days)
        and not exists (select 1 from public.wallet_transactions where contest_id = v_c.id) then
    v_late := true;
  else
    raise exception 'guarantee:closed';
  end if;
  v_ids := public.guarantee_designer_ids(v_c.id, false);
  if cardinality(v_ids) >= v_c.guarantee_designers then
    -- Enough designers counted: only an "ask us to check" claim, with the client's reason.
    if not coalesce(p_disputed, false) then raise exception 'guarantee:enough'; end if;
    if v_note is null or char_length(v_note) < 20 then raise exception 'guarantee:note'; end if;
  end if;
  select * into v_paid from public.guarantee_paid(v_c.id);
  insert into public.guarantee_claims (contest_id, client_id, contest_number, brand_name, late, disputed, min_designers, designers_at_claim,
                                       designer_ids_at_claim, amount, usd_cents, fee_amount, extras_amount, payments, refund_to, client_note)
  values (v_c.id, p_client_id, v_c.contest_number, v_c.brand_name, v_late, cardinality(v_ids) >= v_c.guarantee_designers, v_c.guarantee_designers,
          cardinality(v_ids), v_ids, v_paid.amount, v_paid.usd_cents, v_paid.fee, v_paid.extras, v_paid.lines, p_refund_to, v_note)
  returning * into v_claim;
  return v_claim;
end; $$;
revoke all on function public.open_guarantee_claim(uuid, uuid, text, text, boolean) from public, anon, authenticated;

-- ---- Block 7: the team approves or rejects ----------------------------------------------------------------------
-- p_exclude: [{designer_id, reason}] designers the team leaves out of the count (one person with two accounts, a
-- design that ignores the brief). Approving recounts with the contest locked, held designs included.
create or replace function public.decide_guarantee_claim(p_claim_id uuid, p_admin_id uuid, p_approve boolean, p_reply text, p_internal text, p_exclude jsonb, p_repick_days int)
returns public.guarantee_claims language plpgsql security definer set search_path = public as $$
declare
  v_claim public.guarantee_claims; v_c public.contests; v_ids uuid[]; v_left int; v_paid record;
  v_reply text := nullif(btrim(coalesce(p_reply, '')), '');
  v_internal text := nullif(btrim(coalesce(p_internal, '')), '');
  v_exclude jsonb := coalesce(p_exclude, '[]'::jsonb);
begin
  select * into v_claim from public.guarantee_claims where id = p_claim_id for update;
  if not found or v_claim.status <> 'pending' then raise exception 'guarantee:not_pending'; end if;
  select * into v_c from public.contests where id = v_claim.contest_id for update;
  if not found then raise exception 'guarantee:not_found' using errcode = 'no_data_found'; end if;
  if not p_approve then
    if v_reply is null or char_length(v_reply) < 5 then raise exception 'guarantee:note'; end if;
    update public.guarantee_claims set status = 'rejected', reply = v_reply, internal_note = v_internal, decided_by = p_admin_id, decided_at = now()
     where id = p_claim_id returning * into v_claim;
    -- The client gets at least the re-pick days to pick a winner.
    update public.contests set judging_ends_at = greatest(judging_ends_at, now() + make_interval(days => greatest(p_repick_days, 1)))
     where id = v_c.id and status = 'judging';
    return v_claim;
  end if;
  if v_c.status not in ('judging', 'no_result') then raise exception 'guarantee:status'; end if;
  if exists (select 1 from public.entries where contest_id = v_c.id and status = 'held') then raise exception 'guarantee:held'; end if;
  if exists (select 1 from public.reports r join public.entries e on e.id = r.entry_id where e.contest_id = v_c.id and r.status = 'open') then raise exception 'guarantee:reports'; end if;
  if exists (select 1 from public.handovers where contest_id = v_c.id) then raise exception 'guarantee:winner'; end if;
  if exists (select 1 from public.manual_payments where contest_id = v_c.id and status = 'pending') then raise exception 'guarantee:waiting_payment'; end if;
  if exists (select 1 from public.wallet_transactions where contest_id = v_c.id) then raise exception 'guarantee:paid_out'; end if;
  v_ids := public.guarantee_designer_ids(v_c.id, true);
  select count(*) into v_left from unnest(v_ids) d
   where d not in (select (x ->> 'designer_id')::uuid from jsonb_array_elements(v_exclude) x where x ? 'designer_id');
  if v_left >= v_claim.min_designers then raise exception 'guarantee:enough'; end if;
  select * into v_paid from public.guarantee_paid(v_c.id);
  update public.guarantee_claims set status = 'approved', designers_at_decision = v_left, excluded = v_exclude, amount = v_paid.amount,
         usd_cents = v_paid.usd_cents, fee_amount = v_paid.fee, extras_amount = v_paid.extras, payments = v_paid.lines, reply = v_reply,
         internal_note = v_internal, decided_by = p_admin_id, decided_at = now()
   where id = p_claim_id returning * into v_claim;
  -- No longer pending, so the freeze lets this through. Cancelled: hidden like any cancelled contest, nobody is paid.
  update public.contests set status = 'cancelled', cancel_reason = 'guarantee_refund', cancelled_at = now(),
         cancelled_by = p_admin_id, admin_review = false where id = v_c.id;
  return v_claim;
end; $$;
revoke all on function public.decide_guarantee_claim(uuid, uuid, boolean, text, text, jsonb, int) from public, anon, authenticated;
-- Check: select proname from pg_proc where proname in ('guarantee_stamp', 'guarantee_designer_ids', 'guarantee_paid', 'guarantee_freeze', 'open_guarantee_claim', 'decide_guarantee_claim');   → 6 rows

-- ---- Block 8 ----------------------------------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- ---- Block 9 (optional, only on the day the guarantee is switched on) --------------------------------------------
-- Gives the guarantee to contests that are open and have no designs yet (designers who already sent designs did so
-- under the old rule, so contests with designs are left as they are):
-- update public.contests c set guarantee_designers = 3
--  where c.status = 'open' and c.guarantee_designers is null and not exists (select 1 from public.entries e where e.contest_id = c.id);

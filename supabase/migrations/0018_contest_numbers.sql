-- logocontest.bd — running contest numbers, shown as "Contest #00001" (owner, 2026-10-08; BLUEPRINT.md §2).
-- A contest gets its number when it is published (payment confirmed), so unpaid drafts leave no gaps.
-- Run after 0017 in Supabase → SQL Editor. Safe to re-run.

create sequence if not exists public.contest_number_seq;

alter table public.contests add column if not exists contest_number int unique;

-- Number the contests that already went live, in the order they started.
with ordered as (
  select id, row_number() over (order by starts_at, created_at, id) as n
    from public.contests
   where starts_at is not null and contest_number is null
), base as (
  select coalesce(max(contest_number), 0) as start from public.contests
)
update public.contests c
   set contest_number = base.start + ordered.n
  from ordered, base
 where c.id = ordered.id;

select setval('public.contest_number_seq', greatest((select coalesce(max(contest_number), 0) from public.contests), 1),
              (select max(contest_number) is not null from public.contests));

-- Same as 0004, plus the contest number when the contest opens.
create or replace function public.confirm_contest_payment(
  p_payment_id uuid,
  p_amount int,
  p_gateway_txn_id text,
  p_raw jsonb
)
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
  if v_payment.purpose <> 'contest' then
    raise exception 'payment % is not a contest payment', p_payment_id;
  end if;
  if p_amount <> v_payment.amount or v_payment.amount <> v_contest.total_amount then
    raise exception 'amount mismatch for payment %', p_payment_id using errcode = 'check_violation';
  end if;
  if v_contest.status not in ('draft', 'pending_payment') then
    raise exception 'contest % is not waiting for payment', v_contest.id;
  end if;

  update public.payments
     set status = 'paid', paid_at = now(), gateway_txn_id = p_gateway_txn_id, raw_response = p_raw
   where id = p_payment_id;

  update public.contests
     set status = 'open',
         starts_at = now(),
         ends_at = now() + make_interval(days => v_contest.duration_days),
         contest_number = coalesce(contest_number, nextval('public.contest_number_seq'))
   where id = v_contest.id
  returning * into v_contest;

  return v_contest;
end;
$$;

revoke all on function public.confirm_contest_payment(uuid, int, text, jsonb) from public, anon, authenticated;

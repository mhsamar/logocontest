-- Urgent and Highlight after launch (owner, 2026-11-02): a client can add them to a live contest from the add-ons
-- panel or the daily pop-up, like Featured. Until now they could only be picked when starting the contest.
-- Down migration: supabase/rollback/0082_urgent_highlight_addons_down.sql
-- Run in Supabase → SQL Editor, one block at a time.

-- Block 1. A payment may buy them. ---------------------------------------------------------------------------------
-- Whatever the old check is called, it goes (it only allowed the four first add-ons).
do $$
declare r record;
begin
  for r in select conname from pg_constraint
            where conrelid = 'public.payments'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%addon%'
  loop
    execute format('alter table public.payments drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.payments add constraint payments_addon_check
  check (addon is null or addon in ('promote', 'urgent', 'highlight', 'private', 'blind', 'logo_scan'));

-- Block 2. A paid one switches it on (same as 0033 otherwise). -------------------------------------------------------
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
  elsif v_payment.addon = 'urgent' then
    update public.contests set is_urgent = true where id = v_contest.id returning * into v_contest;
  elsif v_payment.addon = 'highlight' then
    update public.contests set is_highlighted = true where id = v_contest.id returning * into v_contest;
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

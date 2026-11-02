-- Rollback of 0082: Urgent and Highlight can no longer be bought after launch (contests that have them keep them).
-- Run in Supabase → SQL Editor. Fails while a payment for one exists; those rows must be looked at first.

-- The function as 0033 left it.
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

alter table public.payments drop constraint if exists payments_addon_check;
alter table public.payments add constraint payments_addon_check
  check (addon is null or addon in ('promote', 'private', 'blind', 'logo_scan'));

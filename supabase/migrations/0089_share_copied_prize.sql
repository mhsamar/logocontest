-- Copied winner, the owner's rule (2026-11-08): the winner stays the winner, but the prize is shared equally among all
-- the designers who took part (the winner too). A prize already in the winner's wallet is taken back first, as far as
-- the wallet still holds it. The handover is marked paid (credited_at) so the prize is never released to the winner
-- later. Once per contest.
-- Down migration: supabase/rollback/0089_share_copied_prize_down.sql
-- Run in Supabase → SQL Editor, one block at a time.

-- Block 1. The function. --------------------------------------------------------------------------------------------
create or replace function public.admin_share_copied_prize(p_contest_id uuid, p_shares jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c public.contests;
  v_h public.handovers;
  v_paid int := 0;
  v_bal int;
  v_take int := 0;
  v_s jsonb;
  v_designer uuid;
  v_share int;
  v_rate int;
  v_fee int;
  v_count int := 0;
begin
  select * into v_c from public.contests where id = p_contest_id for update;
  if not found or v_c.status not in ('winner_selected', 'handover', 'completed') or v_c.winner_entry_id is null then
    raise exception 'contest % has no winner', p_contest_id;
  end if;
  insert into public.lifecycle_events (contest_id, kind) values (p_contest_id, 'copy_prize_shared')
  on conflict do nothing;
  if not found then
    raise exception 'prize of contest % was already shared', p_contest_id;
  end if;
  select * into v_h from public.handovers
   where contest_id = p_contest_id and status <> 'cancelled'
   order by created_at desc limit 1
   for update;
  if not found then
    raise exception 'contest % has no handover', p_contest_id;
  end if;

  -- A paid prize comes back out of the winner's wallet, as far as it is still there.
  perform 1 from public.profiles where id = v_h.designer_id for update;
  if v_h.credited_at is not null then
    select coalesce(sum(amount), 0)::int into v_paid
      from public.wallet_transactions
     where contest_id = p_contest_id and designer_id = v_h.designer_id and type = 'prize_credit';
    v_bal := public.wallet_balance(v_h.designer_id);
    v_take := least(v_paid, greatest(v_bal, 0));
    if v_take > 0 then
      insert into public.wallet_transactions (designer_id, type, amount, contest_id, balance_after, note)
      values (v_h.designer_id, 'adjustment', -v_take, p_contest_id, v_bal - v_take, 'Prize taken back: the winning logo was copied');
    end if;
  end if;
  -- Never released to the winner later.
  update public.handovers set credited_at = coalesce(credited_at, now()) where id = v_h.id;

  -- The equal shares (worked out by the server, fees as usual).
  for v_s in select * from jsonb_array_elements(coalesce(p_shares, '[]'::jsonb)) loop
    v_designer := (v_s ->> 'designer_id')::uuid;
    v_share := (v_s ->> 'share')::int;
    v_rate := (v_s ->> 'fee_rate')::int;
    if v_share <= 0 then
      continue;
    end if;
    perform 1 from public.profiles where id = v_designer for update;
    v_fee := round(v_share * v_rate / 100.0);
    insert into public.wallet_transactions (designer_id, type, amount, contest_id, fee_rate, fee_amount, balance_after, note)
    values (v_designer, 'split_share', v_share - v_fee, p_contest_id, v_rate, v_fee, public.wallet_balance(v_designer) + v_share - v_fee, 'Copied winner: prize shared');
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('designer_id', v_h.designer_id, 'paid', v_paid, 'taken', v_take, 'short', v_paid - v_take, 'shared', v_count);
end;
$$;

-- Block 2. Only the server may call it. -----------------------------------------------------------------------------
revoke all on function public.admin_share_copied_prize(uuid, jsonb) from public, anon, authenticated;
notify pgrst, 'reload schema';

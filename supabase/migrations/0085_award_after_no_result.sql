-- A winner after a no-result share (owner, 2026-11-06): the team can pick one winner for a contest whose prize was
-- already shared among the designers, and choose whether those shares are taken back from the wallets. A share is
-- taken back only as far as it is still in the wallet (a wallet never goes below zero); the rest is reported.
-- Down migration: supabase/rollback/0085_award_after_no_result_down.sql
-- Run in Supabase → SQL Editor, one block at a time.

-- Block 1. The function. --------------------------------------------------------------------------------------------
create or replace function public.admin_award_no_result(p_contest_id uuid, p_entry_id uuid, p_fee_rate int, p_due_at timestamptz, p_take_back boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c public.contests;
  r record;
  v_bal int;
  v_take int;
  v_taken int := 0;
  v_short int := 0;
  v_out jsonb := '[]'::jsonb;
begin
  select * into v_c from public.contests where id = p_contest_id for update;
  if not found or v_c.status <> 'no_result' then
    raise exception 'contest % has no shared result to change', p_contest_id;
  end if;
  if exists (select 1 from public.handovers where contest_id = p_contest_id) then
    raise exception 'contest % already had a winner', p_contest_id;
  end if;

  if p_take_back then
    for r in
      select designer_id, sum(amount)::int as amount
        from public.wallet_transactions
       where contest_id = p_contest_id and type = 'split_share'
       group by designer_id
    loop
      perform 1 from public.profiles where id = r.designer_id for update;
      v_bal := public.wallet_balance(r.designer_id);
      v_take := least(r.amount, greatest(v_bal, 0));
      if v_take > 0 then
        insert into public.wallet_transactions (designer_id, type, amount, contest_id, balance_after, note)
        values (r.designer_id, 'adjustment', -v_take, p_contest_id, v_bal - v_take, 'No-result share taken back: the team picked a winner');
      end if;
      v_taken := v_taken + v_take;
      v_short := v_short + (r.amount - v_take);
      v_out := v_out || jsonb_build_object('designer_id', r.designer_id, 'taken', v_take, 'short', r.amount - v_take);
    end loop;
  end if;

  update public.contests set status = 'judging', completed_at = null, admin_review = false where id = p_contest_id;
  perform public.pick_winner(p_contest_id, p_entry_id, p_fee_rate, p_due_at);
  return jsonb_build_object('taken', v_taken, 'short', v_short, 'designers', v_out);
end;
$$;

-- Block 2. Only the server may call it. -----------------------------------------------------------------------------
revoke all on function public.admin_award_no_result(uuid, uuid, int, timestamptz, boolean) from public, anon, authenticated;

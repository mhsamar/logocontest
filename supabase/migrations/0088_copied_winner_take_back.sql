-- Copied winner, even after the prize was paid (owner, 2026-11-08): the team takes the win away as in 0086, and when
-- the prize already reached the winner's wallet, it is taken back as far as the wallet still holds it (a wallet never
-- goes below 0, so money already withdrawn shows as "short"). Then the server either lets the client re-pick, picks a
-- new winner, or shares the prize among the other designers (finish_no_result).
-- Down migration: supabase/rollback/0088_copied_winner_take_back_down.sql
-- Run in Supabase → SQL Editor, one block at a time.

-- Block 1. The function (same name and inputs as 0086; it no longer refuses a paid prize). -------------------------
create or replace function public.admin_remove_copied_winner(p_contest_id uuid, p_repick_days int, p_ban boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c public.contests;
  v_h public.handovers;
  v_number int;
  v_paid int := 0;
  v_bal int;
  v_take int := 0;
begin
  select * into v_c from public.contests where id = p_contest_id for update;
  if not found or v_c.status not in ('winner_selected', 'handover', 'completed') or v_c.winner_entry_id is null then
    raise exception 'contest % has no winner to change', p_contest_id;
  end if;
  select * into v_h from public.handovers
   where contest_id = p_contest_id and status <> 'cancelled'
   order by created_at desc limit 1
   for update;
  if not found then
    raise exception 'contest % has no handover', p_contest_id;
  end if;
  perform 1 from public.profiles where id = v_h.designer_id for update;
  select number into v_number from public.entries where id = v_h.entry_id;

  -- A paid prize comes back out of the wallet, as far as it is still there.
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

  -- An approved win is undone first (counts back down), as an upheld copy claim does.
  if v_h.status = 'approved' then
    update public.profiles
       set wins_count = greatest(wins_count - 1, 0),
           counted_wins_count = greatest(counted_wins_count - case when v_h.counts_as_win then 1 else 0 end, 0)
     where id = v_h.designer_id;
  end if;

  update public.handovers set status = 'cancelled', counts_as_win = false where id = v_h.id;
  -- The copier's designs in this contest go, so they can't win again or share the prize.
  update public.entries set status = 'removed'
   where contest_id = p_contest_id and designer_id = v_h.designer_id and status in ('active', 'winner');
  update public.contests
     set status = 'judging', winner_entry_id = null, completed_at = null, admin_review = false,
         judging_ends_at = now() + make_interval(days => p_repick_days)
   where id = p_contest_id;
  if p_ban then
    update public.profiles set status = 'banned', suspended_until = null where id = v_h.designer_id;
  end if;

  return jsonb_build_object('designer_id', v_h.designer_id, 'entry_id', v_h.entry_id, 'number', v_number,
                            'paid', v_paid, 'taken', v_take, 'short', v_paid - v_take);
end;
$$;

-- Block 2. Only the server may call it. -----------------------------------------------------------------------------
revoke all on function public.admin_remove_copied_winner(uuid, int, boolean) from public, anon, authenticated;
notify pgrst, 'reload schema';

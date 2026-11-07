-- Change a winner whose logo was copied (owner, 2026-11-07): the team takes the win away (as an upheld copy claim
-- does, without waiting for the client to claim). The winner's designs in the contest are removed, the handover is
-- cancelled, the contest goes back to picking a winner for the re-pick days, and the copier can be banned. Only
-- while the prize hasn't been paid out.
-- Down migration: supabase/rollback/0086_remove_copied_winner_down.sql
-- Run in Supabase → SQL Editor, one block at a time.

-- Block 1. The function. --------------------------------------------------------------------------------------------
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
  if v_h.credited_at is not null then
    raise exception 'prize for handover % was already paid', v_h.id;
  end if;
  perform 1 from public.profiles where id = v_h.designer_id for update;
  select number into v_number from public.entries where id = v_h.entry_id;

  -- An approved win is undone first (counts back down), as an upheld copy claim does.
  if v_h.status = 'approved' then
    update public.profiles
       set wins_count = greatest(wins_count - 1, 0),
           counted_wins_count = greatest(counted_wins_count - case when v_h.counts_as_win then 1 else 0 end, 0)
     where id = v_h.designer_id;
  end if;

  update public.handovers set status = 'cancelled', counts_as_win = false where id = v_h.id;
  -- The copier's designs in this contest go, so they can't win again or share a no-result prize.
  update public.entries set status = 'removed'
   where contest_id = p_contest_id and designer_id = v_h.designer_id and status in ('active', 'winner');
  update public.contests
     set status = 'judging', winner_entry_id = null, completed_at = null, admin_review = false,
         judging_ends_at = now() + make_interval(days => p_repick_days)
   where id = p_contest_id;
  if p_ban then
    update public.profiles set status = 'banned', suspended_until = null where id = v_h.designer_id;
  end if;

  return jsonb_build_object('designer_id', v_h.designer_id, 'entry_id', v_h.entry_id, 'number', v_number);
end;
$$;

-- Block 2. Only the server may call it. -----------------------------------------------------------------------------
revoke all on function public.admin_remove_copied_winner(uuid, int, boolean) from public, anon, authenticated;

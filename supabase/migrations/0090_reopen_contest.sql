-- Reopen a contest in judging (owner, 2026-11-17): the client doesn't like any design, so the team opens the contest
-- again for more days and every designer is asked for new designs. Only while no winner is picked and no money-back
-- claim is waiting. The old designs stay. The notices already sent for the old end (ending soon, judging reminders,
-- no-winner review, guarantee offer) are cleared, so they go out again for the new end.
-- Down migration: supabase/rollback/0090_reopen_contest_down.sql
-- Run in Supabase → SQL Editor, one block at a time.

-- Block 1. The function. --------------------------------------------------------------------------------------------
create or replace function public.admin_reopen_contest(p_contest_id uuid, p_days int)
returns public.contests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c public.contests;
begin
  if p_days not between 1 and 30 then
    raise exception 'days must be 1 to 30' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.guarantee_claims where contest_id = p_contest_id and status = 'pending') then
    raise exception 'a money-back claim is waiting for contest %', p_contest_id;
  end if;
  update public.contests
     set status = 'open',
         ends_at = now() + make_interval(days => p_days),
         judging_ends_at = null,
         admin_review = false,
         extensions_count = extensions_count + 1,
         extension_days_total = extension_days_total + p_days
   where id = p_contest_id and status = 'judging' and winner_entry_id is null
  returning * into v_c;
  if v_c.id is null then
    raise exception 'contest % is not in judging', p_contest_id;
  end if;
  delete from public.lifecycle_events
   where contest_id = p_contest_id
     and (kind like 'ending_soon%' or kind like 'designer_ending_%' or kind like 'judging_reminder_%'
          or kind in ('no_winner_admin', 'guarantee_available', 'guarantee_available_late'));
  return v_c;
end;
$$;

-- Block 2. Only the server may call it. -----------------------------------------------------------------------------
revoke all on function public.admin_reopen_contest(uuid, int) from public, anon, authenticated;
notify pgrst, 'reload schema';

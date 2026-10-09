-- logocontest.bd — lifecycle engine (owner, 2026-10-08; BLUEPRINT.md §2, §6, §7.5).
-- Every step is one function that checks the state first, so the 15-minute job is safe to run again.
-- Run after 0022 in Supabase → SQL Editor. Safe to re-run.

-- Reminders and notices already sent (so each goes out once).
create table if not exists public.lifecycle_events (
  contest_id  uuid not null references public.contests (id) on delete cascade,
  kind        text not null check (char_length(kind) <= 60),
  created_at  timestamptz not null default now(),
  primary key (contest_id, kind)
);
alter table public.lifecycle_events enable row level security;

-- A contest that ended with no result but where nobody qualified for a share: an admin decides (§7.5).
alter table public.contests add column if not exists admin_review boolean not null default false;

-- Open → judging once ends_at has passed.
create or replace function public.start_judging(p_contest_id uuid, p_judging_days int)
returns public.contests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c public.contests;
begin
  update public.contests
     set status = 'judging', judging_ends_at = ends_at + make_interval(days => p_judging_days)
   where id = p_contest_id and status = 'open' and ends_at <= now()
  returning * into v_c;
  return v_c; -- null when nothing was due
end;
$$;

-- The winner missed the file deadline: the win is cancelled and the client picks again (§6).
create or replace function public.forfeit_handover(p_handover_id uuid, p_repick_days int)
returns public.handovers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_h public.handovers;
begin
  select * into v_h from public.handovers where id = p_handover_id for update;
  if not found or v_h.status not in ('awaiting_files', 'revision_requested') or v_h.due_at > now() then
    return null;
  end if;
  update public.handovers set status = 'cancelled' where id = p_handover_id returning * into v_h;
  update public.entries set status = 'forfeited' where id = v_h.entry_id;
  update public.contests
     set status = 'judging', winner_entry_id = null, judging_ends_at = now() + make_interval(days => p_repick_days)
   where id = v_h.contest_id;
  return v_h;
end;
$$;

-- No result (§2, §7.5): the prize is shared equally; one split_share transaction per designer, all at once.
-- p_shares: [{"designer_id": uuid, "share": int, "fee_rate": int}], worked out by the app from the same rules.
create or replace function public.finish_no_result(p_contest_id uuid, p_shares jsonb)
returns public.contests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c public.contests;
  v_s jsonb;
  v_designer uuid;
  v_share int;
  v_rate int;
  v_fee int;
begin
  select * into v_c from public.contests where id = p_contest_id for update;
  if not found or v_c.status not in ('judging', 'handover', 'winner_selected') then
    return null; -- already finished, or not due
  end if;

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
    values (v_designer, 'split_share', v_share - v_fee, p_contest_id, v_rate, v_fee, public.wallet_balance(v_designer) + v_share - v_fee, null);
  end loop;

  update public.handovers set status = 'no_result' where contest_id = p_contest_id and status in ('awaiting_files', 'submitted', 'revision_requested');
  update public.contests
     set status = 'no_result', completed_at = now(), admin_review = (jsonb_array_length(coalesce(p_shares, '[]'::jsonb)) = 0)
   where id = p_contest_id
  returning * into v_c;
  return v_c;
end;
$$;

-- A change request now gives the designer a new upload deadline (§6).
create or replace function public.request_handover_revision(p_handover_id uuid, p_client_id uuid, p_note text, p_max int)
returns public.handovers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_h public.handovers;
  v_client uuid;
  v_days int;
begin
  select * into v_h from public.handovers where id = p_handover_id for update;
  select client_id into v_client from public.contests where id = v_h.contest_id;
  if not found or v_client is distinct from p_client_id then
    raise exception 'handover % not found', p_handover_id using errcode = 'no_data_found';
  end if;
  if v_h.status <> 'submitted' or v_h.revision_count >= p_max then
    raise exception 'handover % cannot be sent back now', p_handover_id;
  end if;
  select coalesce((value #>> '{}')::int, 3) into v_days from public.settings where key = 'timers.designer_file_upload_days';
  update public.handovers
     set status = 'revision_requested', revision_count = revision_count + 1, revision_note = p_note, review_due_at = null,
         due_at = now() + make_interval(days => coalesce(v_days, 3))
   where id = p_handover_id
  returning * into v_h;
  return v_h;
end;
$$;

revoke all on function public.start_judging(uuid, int) from public, anon, authenticated;
revoke all on function public.forfeit_handover(uuid, int) from public, anon, authenticated;
revoke all on function public.finish_no_result(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.request_handover_revision(uuid, uuid, text, int) from public, anon, authenticated;

notify pgrst, 'reload schema';

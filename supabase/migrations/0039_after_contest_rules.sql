-- After a contest (owner, 2026-10-12): strikes, file delivery, the delivery chat, the payout hold and bKash type.

-- 1. Strikes last 45 days (Settings). 3 strikes inside that time = permanent ban. No more suspensions.
alter table public.strikes drop constraint if exists strikes_issuer_role_check;
alter table public.strikes add constraint strikes_issuer_role_check check (issuer_role in ('client', 'admin', 'system'));

create or replace function public.active_strikes(p_user_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.strikes
   where user_id = p_user_id and removed_at is null
     and created_at > now() - make_interval(days => coalesce((select (value #>> '{}')::int from public.settings where key = 'timers.strike_expiry_days'), 45));
$$;

-- Same name and arguments as before, so every caller keeps working; p_suspend_days is no longer used.
create or replace function public.apply_strike_ladder(p_user_id uuid, p_suspend_days int)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := public.active_strikes(p_user_id);
  v_ban int := coalesce((select (value #>> '{}')::int from public.settings where key = 'limits.strikes_for_ban'), 3);
  v_p public.profiles;
begin
  select * into v_p from public.profiles where id = p_user_id for update;
  if v_p.status <> 'banned' and v_count >= v_ban then
    update public.profiles set strikes = v_count, status = 'banned', suspended_until = null where id = p_user_id returning * into v_p;
  else
    update public.profiles set strikes = v_count where id = p_user_id returning * into v_p;
  end if;
  return v_p;
end;
$$;

-- The nightly job: strikes older than 45 days stop counting. Returns how many accounts changed.
create or replace function public.recount_strikes()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  update public.profiles p set strikes = public.active_strikes(p.id)
   where p.strikes > 0 and p.strikes <> public.active_strikes(p.id);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- 2. The winner must send the first files within 24 hours (Settings) or gets one strike, once per win.
alter table public.handovers add column if not exists late_strike_at timestamptz;

create or replace function public.strike_late_files(p_handover_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_h public.handovers;
  v_hours int := coalesce((select (value #>> '{}')::int from public.settings where key = 'timers.files_strike_hours'), 24);
begin
  select * into v_h from public.handovers where id = p_handover_id for update;
  if not found or v_h.status <> 'awaiting_files' or v_h.submitted_at is not null or v_h.late_strike_at is not null
     or v_h.created_at + make_interval(hours => v_hours) > now() then
    return null;
  end if;
  update public.handovers set late_strike_at = now() where id = p_handover_id;
  insert into public.strikes (user_id, reason, entry_id, contest_id, issued_by, issuer_role)
  values (v_h.designer_id, 'Final files not sent within ' || v_hours || ' hours of winning', v_h.entry_id, v_h.contest_id, null, 'system');
  return public.apply_strike_ladder(v_h.designer_id, 0);
end;
$$;

-- 3. No first files by the deadline (3 days): the win is cancelled, the client picks again, and the designer is
--    banned for good. Only the first delivery has a deadline; change requests go on until the client approves.
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
  if not found or v_h.status <> 'awaiting_files' or v_h.due_at > now() then
    return null;
  end if;
  update public.handovers set status = 'cancelled' where id = p_handover_id returning * into v_h;
  update public.entries set status = 'forfeited' where id = v_h.entry_id;
  update public.contests
     set status = 'judging', winner_entry_id = null, judging_ends_at = now() + make_interval(days => p_repick_days)
   where id = v_h.contest_id;
  update public.profiles set status = 'banned', suspended_until = null where id = v_h.designer_id;
  return v_h;
end;
$$;

-- 4. The delivery chat: the client says what is needed, the designer answers, until the files are approved.
create table if not exists public.handover_messages (
  id           uuid primary key default gen_random_uuid(),
  handover_id  uuid not null references public.handovers (id) on delete cascade,
  author_id    uuid references public.profiles (id) on delete set null,
  body         text not null check (char_length(body) between 1 and 1000),
  created_at   timestamptz not null default now()
);
create index if not exists handover_messages_handover_idx on public.handover_messages (handover_id, created_at);
alter table public.handover_messages enable row level security; -- read and written by the server only

-- 5. The prize is held 3 days (Settings) from the client's approval, and while a copy claim is open.
create or replace function public.release_prize_credit(p_handover_id uuid)
returns public.wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_h public.handovers;
  v_days int := coalesce((select (value #>> '{}')::int from public.settings where key = 'timers.payout_hold_days'), 3);
  v_fee int;
  v_credit int;
  v_tx public.wallet_transactions;
begin
  select * into v_h from public.handovers where id = p_handover_id for update;
  if not found or v_h.status <> 'approved' or v_h.credited_at is not null or v_h.approved_at is null then
    return null;
  end if;
  if v_h.approved_at + make_interval(days => v_days) > now() then
    return null; -- still in the hold
  end if;
  if exists (select 1 from public.copy_claims where handover_id = p_handover_id and status = 'open') then
    return null; -- frozen while a claim is open
  end if;
  perform 1 from public.profiles where id = v_h.designer_id for update;
  v_fee := round(v_h.prize * v_h.fee_rate / 100.0);
  v_credit := v_h.prize - v_fee;
  insert into public.wallet_transactions (designer_id, type, amount, contest_id, fee_rate, fee_amount, balance_after, note)
  values (v_h.designer_id, 'prize_credit', v_credit, v_h.contest_id, v_h.fee_rate, v_fee, public.wallet_balance(v_h.designer_id) + v_credit, null)
  returning * into v_tx;
  update public.handovers set credited_at = now() where id = p_handover_id;
  return v_tx;
end;
$$;

-- 6. bKash numbers are Personal or Agent; the withdrawal keeps which one it was.
alter table public.designer_payout_methods add column if not exists bkash_kind text check (bkash_kind is null or bkash_kind in ('personal', 'agent'));

create or replace function public.request_withdrawal(p_designer_id uuid, p_amount int, p_payout_method_id uuid, p_min int)
returns public.withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_method public.designer_payout_methods;
  v_balance int;
  v_w public.withdrawals;
begin
  perform 1 from public.profiles where id = p_designer_id for update;
  select * into v_method from public.designer_payout_methods where id = p_payout_method_id and user_id = p_designer_id;
  if not found then
    raise exception 'payout method not found' using errcode = 'no_data_found';
  end if;
  v_balance := public.wallet_balance(p_designer_id);
  if p_amount < p_min or p_amount > v_balance then
    raise exception 'amount not allowed' using errcode = 'check_violation';
  end if;
  insert into public.withdrawals (designer_id, payout_method_id, method_type, destination, amount)
  values (
    p_designer_id, v_method.id, v_method.type,
    jsonb_strip_nulls(jsonb_build_object(
      'bkash_number', v_method.bkash_number, 'bkash_kind', v_method.bkash_kind, 'bank_name', v_method.bank_name, 'branch', v_method.branch,
      'account_name', v_method.account_name, 'account_number', v_method.account_number, 'routing_number', v_method.routing_number)),
    p_amount)
  returning * into v_w;
  insert into public.wallet_transactions (designer_id, type, amount, withdrawal_id, balance_after, note)
  values (p_designer_id, 'withdrawal', -p_amount, v_w.id, v_balance - p_amount, v_method.type);
  return v_w;
end;
$$;

revoke all on function public.active_strikes(uuid) from public, anon, authenticated;
revoke all on function public.apply_strike_ladder(uuid, int) from public, anon, authenticated;
revoke all on function public.recount_strikes() from public, anon, authenticated;
revoke all on function public.strike_late_files(uuid) from public, anon, authenticated;
revoke all on function public.forfeit_handover(uuid, int) from public, anon, authenticated;
revoke all on function public.release_prize_credit(uuid) from public, anon, authenticated;
revoke all on function public.request_withdrawal(uuid, int, uuid, int) from public, anon, authenticated;

-- 7. Settings: 3 days to pick a winner, change requests without a limit (0), and the new numbers.
insert into public.settings (key, value, type, "group", description) values
  ('timers.strike_expiry_days', '45'::jsonb, 'int', 'timers', 'Days a strike counts. Strikes older than this no longer count toward a ban.'),
  ('timers.files_strike_hours', '24'::jsonb, 'int', 'timers', 'Hours the winner has to send the first final files before getting a strike.'),
  ('timers.payout_hold_days', '3'::jsonb, 'int', 'timers', 'Days after the client approves the files before the prize can be withdrawn.')
on conflict (key) do nothing;
update public.settings set value = '3'::jsonb where key = 'timers.judging_window_days';
update public.settings set value = '0'::jsonb, description = 'Change requests a client can make during handover. 0 = no limit.' where key = 'limits.max_revision_requests';

notify pgrst, 'reload schema';

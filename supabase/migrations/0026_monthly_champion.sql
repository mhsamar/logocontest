-- logocontest.bd — Monthly Champion (milestone 10, 2026-10-09; BLUEPRINT.md §11).
-- Run after 0025 in Supabase → SQL Editor. Safe to re-run. Nothing is dropped.

create table if not exists public.monthly_winners (
  month         text primary key check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  designer_id   uuid not null references public.profiles (id) on delete cascade,
  wins          int not null check (wins > 0),
  prize_total   int not null default 0,
  avg_rating    numeric(3, 2),
  status        text not null default 'proposed' check (status in ('proposed', 'confirmed')),
  bonus_amount  int,
  proposed_at   timestamptz not null default now(),
  confirmed_by  uuid references public.profiles (id) on delete set null,
  confirmed_at  timestamptz
);
create index if not exists monthly_winners_designer_idx on public.monthly_winners (designer_id) where status = 'confirmed';
alter table public.monthly_winners enable row level security;

-- An admin confirms a month's champion (the proposed one or another ranked designer): the bonus goes to the
-- wallet once. A month that is already confirmed can't be confirmed again.
create or replace function public.confirm_monthly_winner(
  p_month text,
  p_designer_id uuid,
  p_wins int,
  p_prize_total int,
  p_avg_rating numeric,
  p_bonus int,
  p_admin_id uuid
)
returns public.monthly_winners
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m public.monthly_winners;
  v_balance int;
begin
  select * into v_m from public.monthly_winners where month = p_month for update;
  if found and v_m.status = 'confirmed' then
    raise exception 'month % is already confirmed', p_month;
  end if;
  if p_bonus < 0 or p_wins < 1 then
    raise exception 'bad values' using errcode = 'check_violation';
  end if;

  perform 1 from public.profiles where id = p_designer_id and role = 'designer' for update;
  if not found then
    raise exception 'designer % not found', p_designer_id using errcode = 'no_data_found';
  end if;
  if p_bonus > 0 then
    v_balance := public.wallet_balance(p_designer_id);
    insert into public.wallet_transactions (designer_id, type, amount, balance_after, note)
    values (p_designer_id, 'bonus', p_bonus, v_balance + p_bonus, 'monthly_champion:' || p_month);
  end if;

  insert into public.monthly_winners (month, designer_id, wins, prize_total, avg_rating, status, bonus_amount, confirmed_by, confirmed_at)
  values (p_month, p_designer_id, p_wins, p_prize_total, p_avg_rating, 'confirmed', p_bonus, p_admin_id, now())
  on conflict (month) do update
     set designer_id = excluded.designer_id, wins = excluded.wins, prize_total = excluded.prize_total, avg_rating = excluded.avg_rating,
         status = 'confirmed', bonus_amount = excluded.bonus_amount, confirmed_by = excluded.confirmed_by, confirmed_at = excluded.confirmed_at
  returning * into v_m;
  return v_m;
end;
$$;

revoke all on function public.confirm_monthly_winner(text, uuid, int, int, numeric, int, uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';

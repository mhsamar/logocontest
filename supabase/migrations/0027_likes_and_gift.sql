-- logocontest.bd — likes on winning designs, Monthly Winner by likes, gift box delivery
-- (owner, 2026-10-09; BLUEPRINT.md §11, §12). Run after 0026 in Supabase → SQL Editor. Safe to re-run. Nothing is dropped.

-- One like per designer per winning design (the app checks who may like what).
create table if not exists public.design_likes (
  entry_id    uuid not null references public.entries (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (entry_id, user_id)
);
create index if not exists design_likes_entry_idx on public.design_likes (entry_id);
alter table public.design_likes enable row level security;

-- Monthly Winner is now a design, and the prize is a gift box sent to the winner.
alter table public.monthly_winners alter column wins drop not null;
alter table public.monthly_winners add column if not exists entry_id uuid references public.entries (id) on delete set null;
alter table public.monthly_winners add column if not exists likes int not null default 0;
alter table public.monthly_winners add column if not exists gift_status text check (gift_status is null or gift_status in ('awaiting_address', 'address_given', 'sent'));
alter table public.monthly_winners add column if not exists ship_name text check (ship_name is null or char_length(ship_name) <= 80);
alter table public.monthly_winners add column if not exists ship_phone text check (ship_phone is null or char_length(ship_phone) <= 20);
alter table public.monthly_winners add column if not exists ship_address text check (ship_address is null or char_length(ship_address) <= 400);
alter table public.monthly_winners add column if not exists address_at timestamptz;
alter table public.monthly_winners add column if not exists sent_at timestamptz;
alter table public.monthly_winners add column if not exists sent_note text check (sent_note is null or char_length(sent_note) <= 300);

-- An admin picks a month's winning design. A month that is already confirmed can't be picked again.
create or replace function public.pick_monthly_design(p_month text, p_entry_id uuid, p_likes int, p_admin_id uuid)
returns public.monthly_winners
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m public.monthly_winners;
  v_designer uuid;
begin
  select * into v_m from public.monthly_winners where month = p_month for update;
  if found and v_m.status = 'confirmed' then
    raise exception 'month % is already confirmed', p_month;
  end if;
  select designer_id into v_designer from public.entries where id = p_entry_id and status = 'winner';
  if v_designer is null then
    raise exception 'entry % is not a winning design', p_entry_id using errcode = 'no_data_found';
  end if;

  insert into public.monthly_winners (month, entry_id, designer_id, likes, status, gift_status, confirmed_by, confirmed_at)
  values (p_month, p_entry_id, v_designer, p_likes, 'confirmed', 'awaiting_address', p_admin_id, now())
  on conflict (month) do update
     set entry_id = excluded.entry_id, designer_id = excluded.designer_id, likes = excluded.likes, status = 'confirmed',
         gift_status = 'awaiting_address', confirmed_by = excluded.confirmed_by, confirmed_at = excluded.confirmed_at,
         wins = null, prize_total = 0, avg_rating = null, bonus_amount = null
  returning * into v_m;
  return v_m;
end;
$$;

revoke all on function public.pick_monthly_design(text, uuid, int, uuid) from public, anon, authenticated;

insert into public.settings (key, value, type, "group", description) values
  ('timers.designer_ending_notice_hours', '[12, 6]'::jsonb, 'json', 'timers', 'Hours before a contest ends when every designer is told to submit (newest first is fine).')
on conflict (key) do nothing;

notify pgrst, 'reload schema';

-- logocontest.bd — Milestone 2: contests, contest_files, payments (BLUEPRINT.md §5, §6, §7.1).
-- Run after 0003 in Supabase → SQL Editor. Safe to re-run.

do $$ begin
  create type public.contest_status as enum (
    'draft', 'pending_payment', 'open', 'judging', 'winner_selected',
    'handover', 'completed', 'no_result', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contest_package as enum ('economy', 'standard', 'premium', 'custom');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contest_file_type as enum ('example', 'current_logo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_purpose as enum ('contest', 'extension');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('initiated', 'paid', 'failed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- contests
-- ---------------------------------------------------------------------------
create table if not exists public.contests (
  id                          uuid primary key default gen_random_uuid(),
  client_id                   uuid not null references public.profiles (id) on delete restrict,
  slug                        text not null unique,
  status                      public.contest_status not null default 'draft',

  brand_name                  text not null check (char_length(brand_name) between 2 and 60),
  logo_text                   text check (logo_text is null or char_length(logo_text) <= 60),
  slogan                      text check (slogan is null or char_length(slogan) <= 100),
  business_type               text not null,
  business_description        text not null check (char_length(business_description) between 20 and 300),
  website_url                 text,
  styles                      jsonb not null default '[]'::jsonb,
  style_sliders               jsonb not null default '{}'::jsonb,
  colors                      jsonb not null default '[]'::jsonb,
  let_designers_choose_colors boolean not null default false,
  used_on                     jsonb not null default '[]'::jsonb,
  likes_text                  text not null,
  dislikes_text               text,

  package                     public.contest_package not null,
  prize_amount                int not null check (prize_amount > 0),
  service_fee_amount          int not null check (service_fee_amount >= 0),
  upgrades_amount             int not null default 0 check (upgrades_amount >= 0),
  total_amount                int not null,
  duration_days               int not null check (duration_days > 0),
  is_blind                    boolean not null default false,
  is_private                  boolean not null default false,
  is_promoted                 boolean not null default false,
  winner_is_public            boolean not null default false,

  starts_at                   timestamptz,
  ends_at                     timestamptz,
  judging_ends_at             timestamptz,
  extensions_count            int not null default 0,
  extension_days_total        int not null default 0,
  winner_entry_id             uuid,
  completed_at                timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  constraint contests_total_matches check (total_amount = prize_amount + service_fee_amount + upgrades_amount),
  constraint contests_live_has_dates check (status in ('draft', 'pending_payment', 'cancelled') or (starts_at is not null and ends_at is not null)),
  constraint contests_colors_max_5 check (jsonb_array_length(colors) <= 5)
);

create index if not exists contests_client_idx on public.contests (client_id, created_at desc);
create index if not exists contests_status_idx on public.contests (status, ends_at);

drop trigger if exists contests_touch on public.contests;
create trigger contests_touch before update on public.contests
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- contest_files (wizard step 7). Stored in the private "contest-files" bucket.
-- ---------------------------------------------------------------------------
create table if not exists public.contest_files (
  id            uuid primary key default gen_random_uuid(),
  contest_id    uuid not null references public.contests (id) on delete cascade,
  type          public.contest_file_type not null default 'example',
  path          text not null unique,
  original_name text not null,
  mime_type     text not null,
  size_bytes    int not null check (size_bytes > 0),
  created_at    timestamptz not null default now()
);

create index if not exists contest_files_contest_idx on public.contest_files (contest_id);

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  contest_id      uuid not null references public.contests (id) on delete restrict,
  client_id       uuid not null references public.profiles (id) on delete restrict,
  purpose         public.payment_purpose not null default 'contest',
  extension_days  int check (extension_days is null or extension_days > 0),
  gateway         text not null,
  method          text not null check (method in ('bkash', 'card')),
  gateway_txn_id  text,
  amount          int not null check (amount > 0),
  status          public.payment_status not null default 'initiated',
  paid_at         timestamptz,
  raw_response    jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint payments_paid_has_time check (status <> 'paid' or paid_at is not null)
);

create index if not exists payments_contest_idx on public.payments (contest_id, created_at desc);
create index if not exists payments_client_idx on public.payments (client_id, created_at desc);

drop trigger if exists payments_touch on public.payments;
create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Guard: a contest can never go live without a paid contest payment.
-- ---------------------------------------------------------------------------
create or replace function public.contests_require_paid_payment()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'open' and old.status in ('draft', 'pending_payment') then
    if not exists (
      select 1 from public.payments
      where contest_id = new.id and purpose = 'contest' and status = 'paid'
    ) then
      raise exception 'contest % cannot open without a paid payment', new.id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists contests_paid_guard on public.contests;
create trigger contests_paid_guard before update of status on public.contests
  for each row execute function public.contests_require_paid_payment();

-- ---------------------------------------------------------------------------
-- Payment state changes. Each runs in one transaction and is idempotent, so a
-- gateway callback that arrives twice is harmless.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_contest_payment(
  p_payment_id uuid,
  p_amount int,
  p_gateway_txn_id text,
  p_raw jsonb
)
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
  if v_payment.purpose <> 'contest' then
    raise exception 'payment % is not a contest payment', p_payment_id;
  end if;
  if p_amount <> v_payment.amount or v_payment.amount <> v_contest.total_amount then
    raise exception 'amount mismatch for payment %', p_payment_id using errcode = 'check_violation';
  end if;
  if v_contest.status not in ('draft', 'pending_payment') then
    raise exception 'contest % is not waiting for payment', v_contest.id;
  end if;

  update public.payments
     set status = 'paid', paid_at = now(), gateway_txn_id = p_gateway_txn_id, raw_response = p_raw
   where id = p_payment_id;

  update public.contests
     set status = 'open',
         starts_at = now(),
         ends_at = now() + make_interval(days => v_contest.duration_days)
   where id = v_contest.id
  returning * into v_contest;

  return v_contest;
end;
$$;

create or replace function public.fail_contest_payment(p_payment_id uuid, p_raw jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found or v_payment.status <> 'initiated' then
    return; -- already settled
  end if;

  update public.payments set status = 'failed', raw_response = p_raw where id = p_payment_id;
  -- The contest stays a draft so the client can try again.
  update public.contests set status = 'draft'
   where id = v_payment.contest_id and status = 'pending_payment';
end;
$$;

revoke all on function public.confirm_contest_payment(uuid, int, text, jsonb) from public, anon, authenticated;
revoke all on function public.fail_contest_payment(uuid, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security. Writes happen only through server code (service role).
-- Public read access for live contests is added in milestone 3.
-- ---------------------------------------------------------------------------
alter table public.contests      enable row level security;
alter table public.contest_files enable row level security;
alter table public.payments      enable row level security;

drop policy if exists "contests: owner reads" on public.contests;
create policy "contests: owner reads" on public.contests
  for select to authenticated using (client_id = auth.uid() or public.is_admin());

drop policy if exists "contest_files: owner reads" on public.contest_files;
create policy "contest_files: owner reads" on public.contest_files
  for select to authenticated using (
    exists (select 1 from public.contests c where c.id = contest_id and (c.client_id = auth.uid() or public.is_admin()))
  );

drop policy if exists "payments: owner reads" on public.payments;
create policy "payments: owner reads" on public.payments
  for select to authenticated using (client_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: private bucket for wizard uploads (examples / current logo).
-- ---------------------------------------------------------------------------
-- Size and type limits are checked by the server from settings (limits.brief_*).
insert into storage.buckets (id, name, public)
values ('contest-files', 'contest-files', false)
on conflict (id) do nothing;

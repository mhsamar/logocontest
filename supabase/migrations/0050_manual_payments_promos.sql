-- Manual bKash payments, payment methods, promo codes, QA transaction IDs and Stripe (owner, 2026-10-14).
-- Until the bKash API and SSLCommerz are set up, people send money to the bKash personal or merchant number and give
-- the transaction ID (and a screenshot if they like); an admin checks it and approves, then the contest goes live,
-- the add-on is added or Pro turns on. Each method has its own on/off switch in Admin > Payments > Methods.
-- Visitors from abroad see prices in US dollars and pay by card with Stripe; every amount is still kept in taka.
-- Down migration: supabase/rollback/0050_manual_payments_promos_down.sql

-- 1. Payment methods ------------------------------------------------------------------------------------
create table if not exists public.payment_methods (
  key             text primary key,
  enabled         boolean not null default false,
  account_number  text check (account_number is null or account_number ~ '^\+?[0-9]{11,14}$'),
  account_name    text check (account_name is null or char_length(account_name) <= 60),
  note_en         text check (note_en is null or char_length(note_en) <= 300),
  note_bn         text check (note_bn is null or char_length(note_bn) <= 300),
  position        smallint not null default 0,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id) on delete set null
);
alter table public.payment_methods drop constraint if exists payment_methods_key_check;
alter table public.payment_methods add constraint payment_methods_key_check check (key in ('bkash_personal', 'bkash_merchant', 'bkash_api', 'sslcommerz', 'stripe'));
insert into public.payment_methods (key, enabled, account_number, position) values
  ('bkash_personal', true, '+8801677713493', 1),
  ('bkash_merchant', true, '+8801712028511', 2),
  ('bkash_api', false, null, 3),
  ('sslcommerz', false, null, 4),
  ('stripe', false, null, 5)
on conflict (key) do nothing;
alter table public.payment_methods enable row level security;
-- The numbers are shown to everyone who pays.
drop policy if exists payment_methods_read on public.payment_methods;
create policy payment_methods_read on public.payment_methods for select using (true);

-- 2. Manual payments: the transaction ID (and screenshot) a payer sends, and the admin's decision ------------
create table if not exists public.manual_payments (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null check (kind in ('contest', 'addon', 'pro')),
  payment_id       uuid not null,                       -- payments.id (contest, add-on, extension) or pro_payments.id
  user_id          uuid not null references public.profiles (id) on delete cascade,
  contest_id       uuid references public.contests (id) on delete set null,
  method           text not null check (method in ('bkash_personal', 'bkash_merchant')),
  to_number        text not null,
  amount           int not null check (amount > 0),
  txn_id           text not null check (txn_id ~ '^[A-Z0-9]{8,14}$'),
  sender_number    text check (sender_number is null or sender_number ~ '^\+?[0-9]{11,14}$'),
  screenshot_path  text,
  status           text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  qa_code          text,                                -- the QA test ID it matched, if any
  note             text check (note is null or char_length(note) <= 300),
  reviewed_by      uuid references public.profiles (id) on delete set null,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists manual_payments_status_idx on public.manual_payments (status, created_at desc);
create index if not exists manual_payments_user_idx on public.manual_payments (user_id, created_at desc);
-- One waiting or approved proof per payment, and a transaction ID can't be used twice.
create unique index if not exists manual_payments_payment_once on public.manual_payments (kind, payment_id) where status in ('pending', 'approved');
create unique index if not exists manual_payments_txn_once on public.manual_payments (txn_id) where status in ('pending', 'approved');
alter table public.manual_payments enable row level security;
drop policy if exists manual_payments_read on public.manual_payments;
create policy manual_payments_read on public.manual_payments for select using (user_id = auth.uid() or public.admin_can('payments.view'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 3. Promo codes: random one-time codes, or one shared code (each account once) --------------------------
create table if not exists public.promo_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z0-9-]{4,24}$'),
  audience    text not null check (audience in ('client', 'designer')),
  -- client_fee: the contest's service fee becomes `value` %; designer_fee: the fee on the designer's next win
  -- becomes `value` %; pro_discount: `value` % off the Pro plan price.
  kind        text not null check (kind in ('client_fee', 'designer_fee', 'pro_discount')),
  value       smallint not null check (value between 0 and 100),
  mode        text not null check (mode in ('single', 'shared')),
  max_uses    int check (max_uses is null or max_uses > 0),
  starts_at   timestamptz,
  ends_at     timestamptz,
  active      boolean not null default true,
  label       text check (label is null or char_length(label) <= 60),
  batch_id    uuid,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  check ((audience = 'client') = (kind = 'client_fee')),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists promo_codes_batch_idx on public.promo_codes (batch_id);
alter table public.promo_codes enable row level security;
drop policy if exists promo_codes_admin on public.promo_codes;
create policy promo_codes_admin on public.promo_codes for select using (public.admin_can('payments.view'));

create table if not exists public.promo_redemptions (
  id          uuid primary key default gen_random_uuid(),
  code_id     uuid not null references public.promo_codes (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  status      text not null default 'reserved' check (status in ('reserved', 'used', 'released')),
  value       smallint not null,
  contest_id  uuid references public.contests (id) on delete set null,
  payment_id  uuid,                                   -- the payment it lowered (contest or Pro), when there is one
  created_at  timestamptz not null default now(),
  used_at     timestamptz
);
-- Each account uses a code once.
create unique index if not exists promo_redemptions_once on public.promo_redemptions (code_id, user_id) where status <> 'released';
create index if not exists promo_redemptions_user_idx on public.promo_redemptions (user_id, status);
alter table public.promo_redemptions enable row level security;
drop policy if exists promo_redemptions_read on public.promo_redemptions;
create policy promo_redemptions_read on public.promo_redemptions for select using (user_id = auth.uid() or public.admin_can('payments.view'));

-- Reserves a code for one person in one step (the code row is locked, so two people can't both take a one-time
-- code). The same person asking again gets their own reservation back. Returns the redemption.
create or replace function public.reserve_promo(p_code text, p_user_id uuid, p_kinds text[])
returns public.promo_redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.promo_codes;
  v_red  public.promo_redemptions;
  v_used int;
begin
  select * into v_code from public.promo_codes where code = upper(trim(p_code)) for update;
  if not found or not (v_code.kind = any (p_kinds)) then
    raise exception 'promo_not_found' using errcode = 'P0002';
  end if;
  select * into v_red from public.promo_redemptions where code_id = v_code.id and user_id = p_user_id and status <> 'released';
  if found then
    if v_red.status = 'used' then
      raise exception 'promo_used' using errcode = 'P0001';
    end if;
    return v_red;
  end if;
  if not v_code.active or (v_code.starts_at is not null and v_code.starts_at > now()) or (v_code.ends_at is not null and v_code.ends_at <= now()) then
    raise exception 'promo_inactive' using errcode = 'P0001';
  end if;
  select count(*) into v_used from public.promo_redemptions where code_id = v_code.id and status <> 'released';
  if (v_code.mode = 'single' and v_used >= 1) or (v_code.max_uses is not null and v_used >= v_code.max_uses) then
    raise exception 'promo_used' using errcode = 'P0001';
  end if;
  insert into public.promo_redemptions (code_id, user_id, value) values (v_code.id, p_user_id, v_code.value) returning * into v_red;
  return v_red;
end;
$$;
revoke all on function public.reserve_promo(text, uuid, text[]) from public, anon, authenticated;

-- The contest's promo (shown on the contest and in Admin > Payments).
alter table public.contests add column if not exists promo_redemption_id uuid references public.promo_redemptions (id) on delete set null;

-- 4. QA transaction IDs: made by an admin for testing the manual bKash flow ------------------------------
create table if not exists public.qa_txn_codes (
  code        text primary key check (code ~ '^[A-Z0-9]{10}$'),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  used_by     uuid references public.manual_payments (id) on delete set null,
  used_at     timestamptz
);
alter table public.qa_txn_codes enable row level security;
drop policy if exists qa_txn_codes_admin on public.qa_txn_codes;
create policy qa_txn_codes_admin on public.qa_txn_codes for select using (public.admin_can('payments.view'));

-- 5. Stripe: card payments in US dollars for visitors from abroad ----------------------------------------------
-- The payment keeps its taka amount; the dollars charged (in cents) and Stripe's checkout session are kept too.
alter table public.payments add column if not exists currency text not null default 'BDT';
alter table public.payments add column if not exists charged_cents int;
alter table public.payments add column if not exists provider_ref text;
alter table public.payments drop constraint if exists payments_currency_check;
alter table public.payments add constraint payments_currency_check check (currency in ('BDT', 'USD') and (charged_cents is null or charged_cents > 0));
alter table public.pro_payments add column if not exists currency text not null default 'BDT';
alter table public.pro_payments add column if not exists charged_cents int;
alter table public.pro_payments drop constraint if exists pro_payments_currency_check;
alter table public.pro_payments add constraint pro_payments_currency_check check (currency in ('BDT', 'USD') and (charged_cents is null or charged_cents > 0));
create index if not exists payments_provider_ref_idx on public.payments (provider_ref) where provider_ref is not null;

-- Dollar prices: taka per dollar, and a % added to cover card fees (Admin > Settings > Dollar prices).
insert into public.settings (key, value, type, "group", description) values
  ('payments.usd_rate', '122'::jsonb, 'int', 'payments', 'Taka per US dollar. Visitors from abroad see every price in dollars at this rate and pay with Stripe.'),
  ('payments.usd_markup_percent', '0'::jsonb, 'int', 'payments', 'Added to dollar prices to cover card and currency fees, in percent (0 = none).')
on conflict (key) do nothing;

notify pgrst, 'reload schema';

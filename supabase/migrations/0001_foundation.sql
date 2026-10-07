-- logocontest.bd — Milestone 1 (Foundation)
-- Run once in Supabase → SQL Editor. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('client', 'designer', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_status as enum ('active', 'suspended', 'banned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.otp_purpose as enum ('register', 'reset');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.setting_type as enum ('int', 'bool', 'string', 'json');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Users (profiles). One row per auth.users row, created by trigger.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  phone             text not null unique check (phone ~ '^\+8801[3-9][0-9]{8}$'),
  name              text not null check (char_length(name) between 1 and 80),
  role              public.user_role not null default 'client',
  status            public.user_status not null default 'active',
  locale            text not null default 'en' check (locale in ('en', 'bn')),
  phone_verified_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

-- Role is never taken from user input: every new account starts as "client".
-- Accounts are only created server-side after OTP verification.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone, name, locale, phone_verified_at)
  values (
    new.id,
    new.raw_user_meta_data ->> 'phone',
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), 'User'),
    coalesce(new.raw_user_meta_data ->> 'locale', 'en'),
    now()
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- Settings: every admin-changeable number lives here.
-- Rows are seeded from src/lib/settings/registry.ts by `npm run seed`.
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  key         text primary key,
  value       jsonb not null,
  type        public.setting_type not null,
  "group"     text not null,
  description text not null default '',
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id) on delete set null
);

drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- OTP codes. Only the server (service role) reads or writes these.
-- ---------------------------------------------------------------------------
create table if not exists public.otp_codes (
  id                 uuid primary key default gen_random_uuid(),
  phone              text not null,
  purpose            public.otp_purpose not null,
  code_hash          text not null,
  attempts           int not null default 0,
  ip                 text,
  expires_at         timestamptz not null,
  verified_at        timestamptz,
  ticket_hash        text,
  consumed_at        timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists otp_codes_phone_idx on public.otp_codes (phone, purpose, created_at desc);
create index if not exists otp_codes_ip_idx on public.otp_codes (ip, created_at desc);

create or replace function public.otp_increment_attempts(otp_id uuid)
returns int
language sql
security definer
set search_path = public
as $$
  update public.otp_codes set attempts = attempts + 1
  where id = otp_id
  returning attempts;
$$;

revoke all on function public.otp_increment_attempts(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Login attempts, for rate limiting.
-- ---------------------------------------------------------------------------
create table if not exists public.login_attempts (
  id         bigint generated always as identity primary key,
  phone      text not null,
  ip         text,
  succeeded  boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists login_attempts_phone_idx on public.login_attempts (phone, created_at desc);
create index if not exists login_attempts_ip_idx on public.login_attempts (ip, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.settings       enable row level security;
alter table public.otp_codes      enable row level security;
alter table public.login_attempts enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "profiles: admin reads all" on public.profiles;
create policy "profiles: admin reads all" on public.profiles
  for select to authenticated using (public.is_admin());

-- Settings are not secret (prices, limits) but are only changed by the server.
drop policy if exists "settings: public read" on public.settings;
create policy "settings: public read" on public.settings
  for select to anon, authenticated using (true);

-- otp_codes and login_attempts have no policies: only the service role can use them.

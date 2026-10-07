-- logocontest.bd — email confirmation and emailed password reset (owner, 2026-10-07; BLUEPRINT.md §4, §5, §12).
-- Run after 0005 in Supabase → SQL Editor. Safe to re-run.

alter table public.profiles add column if not exists email_verified_at timestamptz;

-- One-time confirmation links. Only the token's hash is stored.
create table if not exists public.email_verifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  email       text not null,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists email_verifications_user_idx on public.email_verifications (user_id, created_at desc);

-- Every email we send, for rate limits (confirmation resends, reset requests).
create table if not exists public.email_sends (
  id         bigint generated always as identity primary key,
  kind       text not null check (kind in ('verify', 'reset')),
  email      text not null,
  ip         text,
  created_at timestamptz not null default now()
);

create index if not exists email_sends_email_idx on public.email_sends (kind, email, created_at desc);
create index if not exists email_sends_ip_idx on public.email_sends (kind, ip, created_at desc);

-- Server-only tables: RLS on, no policies.
alter table public.email_verifications enable row level security;
alter table public.email_sends         enable row level security;

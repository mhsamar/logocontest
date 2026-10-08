-- logocontest.bd — designer sign-up D-01 (owner, 2026-10-08; BLUEPRINT.md §5, UI-JOURNEY D-01).
-- Run after 0008 in Supabase → SQL Editor. Safe to re-run.

-- When the designer ticked the Designer Rules at sign-up.
alter table public.profiles add column if not exists rules_accepted_at timestamptz;

-- Usernames are unique ignoring case.
create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username)) where username is not null;

-- Where a designer's winnings are paid out.
create table if not exists public.designer_payout_methods (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  type            text not null check (type in ('bkash', 'bank')),
  bkash_number    text,
  bank_name       text,
  branch          text,
  account_name    text,
  account_number  text,
  routing_number  text,
  is_default      boolean not null default true,
  created_at      timestamptz not null default now(),
  constraint payout_bkash_has_number check (type <> 'bkash' or bkash_number is not null),
  constraint payout_bank_has_account check (type <> 'bank' or (bank_name is not null and account_name is not null and account_number is not null))
);

create index if not exists designer_payout_methods_user_idx on public.designer_payout_methods (user_id);

-- Server-only table: RLS on, no policies.
alter table public.designer_payout_methods enable row level security;

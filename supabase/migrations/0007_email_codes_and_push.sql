-- logocontest.bd — 6-digit email codes and browser push (owner, 2026-10-07; BLUEPRINT.md §4, §5, §12).
-- Run after 0006 in Supabase → SQL Editor. Safe to re-run.

-- Confirm-your-email now uses a typed 6-digit code instead of a link.
-- token_hash holds the code's hash; two codes can hash alike only for the same user, so it is no longer unique.
alter table public.email_verifications drop constraint if exists email_verifications_token_hash_key;
alter table public.email_verifications add column if not exists attempts int not null default 0;

-- Replaced by auth.email_code_ttl_minutes.
delete from public.settings where key = 'auth.email_verify_ttl_hours';

-- One row per browser that allowed notifications (Web Push).
create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Server-only table: RLS on, no policies.
alter table public.push_subscriptions enable row level security;

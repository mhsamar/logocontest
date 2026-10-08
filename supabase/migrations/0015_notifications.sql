-- logocontest.bd — in-app notifications (owner, 2026-10-08; BLUEPRINT.md §5, §12).
-- Run after 0014 in Supabase → SQL Editor. Safe to re-run.

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null,
  data        jsonb not null default '{}'::jsonb,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- Server-only table: RLS on, no policies.
alter table public.notifications enable row level security;

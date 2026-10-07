-- logocontest.bd — public contest comments, saved contests, blocked terms (owner, 2026-10-08; BLUEPRINT.md §5, §10).
-- Run after 0007 in Supabase → SQL Editor. Safe to re-run.

-- Public comment list on each contest. Only the contest's client and designers post (checked on the server).
create table if not exists public.contest_comments (
  id          uuid primary key default gen_random_uuid(),
  contest_id  uuid not null references public.contests (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  is_hidden   boolean not null default false,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists contest_comments_contest_idx on public.contest_comments (contest_id, created_at);

-- Contests a designer saved (heart).
create table if not exists public.contest_favorites (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  contest_id  uuid not null references public.contests (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, contest_id)
);

create index if not exists contest_favorites_user_idx on public.contest_favorites (user_id, created_at desc);

-- Extra words the no-contact filter blocks, managed by admins (BLUEPRINT §10).
create table if not exists public.blocked_terms (
  id          bigint generated always as identity primary key,
  term        text not null unique check (char_length(term) between 2 and 60),
  language    text not null default 'any' check (language in ('en', 'bn', 'any')),
  type        text not null default 'custom' check (type in ('phone', 'email', 'social', 'link', 'custom')),
  created_at  timestamptz not null default now()
);

-- Server-only tables: RLS on, no policies.
alter table public.contest_comments  enable row level security;
alter table public.contest_favorites enable row level security;
alter table public.blocked_terms     enable row level security;

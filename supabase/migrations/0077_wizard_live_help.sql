-- 0077 Unpaid contests, phase 2 (owner, 2026-10-25; Design/unpaid-contests): "Creating a contest right now". While someone
-- fills in Start a contest, the team sees which step they are on and their form answers (never passwords or payment
-- details), and may send them one help message on that page (never during payment). Only the server reads or writes
-- these tables (RLS on, no policies). Visitors and clients never read them directly.
-- Run in Supabase → SQL Editor, ONE BLOCK AT A TIME, in order. Every block is safe to re-run.

-- ---- Block 1: one row per Start a contest visit, refreshed every few seconds while the page is open --------------------
-- Deleted after a day by the daily clean-up. The answers are a fixed list of form fields chosen on the server.
create table if not exists public.wizard_live (
  visit_id     uuid primary key,
  user_id      uuid references public.profiles (id) on delete cascade,
  contest_id   uuid references public.contests (id) on delete set null,
  service      text not null default 'logo' check (char_length(service) <= 60),
  stage        smallint not null check (stage between 1 and 10),
  pos          smallint check (pos is null or pos between 1 and 20),
  steps_total  smallint check (steps_total is null or steps_total between 1 and 20),
  doing        text check (doing is null or char_length(doing) <= 40),
  answers      jsonb not null default '{}'::jsonb,
  total        integer,
  device       text check (device is null or char_length(device) <= 10),
  country      text check (country is null or char_length(country) <= 2),
  city         text check (city is null or char_length(city) <= 80),
  locale       text check (locale is null or locale in ('en', 'bn')),
  away         boolean not null default false,
  started_at   timestamptz not null default now(),
  step_since   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  ended_at     timestamptz
);
create index if not exists wizard_live_now_idx on public.wizard_live (updated_at desc) where ended_at is null;
alter table public.wizard_live enable row level security;

-- ---- Block 2: the one help message a visit may get, and how the visitor answered ---------------------------------------
-- visit_id is unique: at most one message per visit, even when two admins press Send at the same moment.
create table if not exists public.help_offers (
  id                uuid primary key default gen_random_uuid(),
  visit_id          uuid not null unique,
  user_id           uuid references public.profiles (id) on delete set null,
  contest_id        uuid references public.contests (id) on delete set null,
  admin_id          uuid references public.profiles (id) on delete set null,
  status            text not null default 'sent' check (status in ('sent', 'seen', 'replied', 'call_me', 'declined')),
  stage_at_send     smallint,
  seen_at           timestamptz,
  answered_at       timestamptz,
  visitor_typing_at timestamptz,
  admin_seen_at     timestamptz,
  unread_by_admin   smallint not null default 0,
  last_message_at   timestamptz not null default now(),
  created_at        timestamptz not null default now()
);
create index if not exists help_offers_contest_idx on public.help_offers (contest_id) where contest_id is not null;
alter table public.help_offers enable row level security;

-- ---- Block 3: the messages of that help chat ----------------------------------------------------------------------------
create table if not exists public.help_messages (
  id          bigint generated always as identity primary key,
  offer_id    uuid not null references public.help_offers (id) on delete cascade,
  from_admin  boolean not null,
  admin_id    uuid references public.profiles (id) on delete set null,
  kind        text not null default 'text' check (kind in ('text', 'call_me', 'no_thanks')),
  body        text check (body is null or char_length(body) <= 1000),
  created_at  timestamptz not null default now()
);
create index if not exists help_messages_offer_idx on public.help_messages (offer_id, id);
alter table public.help_messages enable row level security;

-- Check: select count(*) from public.wizard_live; select count(*) from public.help_offers; select count(*) from public.help_messages;

notify pgrst, 'reload schema';

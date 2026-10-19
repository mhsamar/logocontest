-- 0067 Contest cards (owner, 2026-10-19; Design/contest-cards): when a contest goes live, the site makes a photo card
-- (4 sizes) and Admin › Contest cards posts it to the logocontest.bd Facebook page. Adds only: no existing data changes.
-- Run in Supabase → SQL Editor, one block at a time. Safe to re-run.

-- Block 1: the client's "Share my contest on Facebook" switch (contest form), on by default.
alter table public.contests add column if not exists share_on_facebook boolean not null default true;

-- Block 2: one card per contest and kind ('new' when it goes live, 'last24' for the optional last-day post).
create table if not exists public.contest_cards (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  kind text not null default 'new' check (kind in ('new', 'last24')),
  style text not null check (style in ('maroon', 'light', 'big')),
  line_bn text,
  images jsonb not null default '{}'::jsonb,
  caption text,
  status text not null default 'waiting' check (status in ('waiting', 'scheduled', 'posted', 'failed', 'skipped')),
  skip_reason text,
  fb_post_id text,
  fb_post_url text,
  scheduled_at timestamptz,
  posted_at timestamptz,
  posted_by uuid references public.profiles(id) on delete set null,
  error text,
  attempts int not null default 0,
  tried_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contest_id, kind)
);
alter table public.contest_cards enable row level security;
create index if not exists contest_cards_status_idx on public.contest_cards (status, created_at desc);

-- Block 3: the card pictures. Public, so Facebook can read them; PNG only, 8 MB each.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contest-cards', 'contest-cards', true, 8388608, array['image/png'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
notify pgrst, 'reload schema';

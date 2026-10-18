-- 0066 Pinterest auto-posting (owner, 2026-10-19): Admin › Pinterest connects the site's own Pinterest account and
-- pins winning designs (and, if the admin chooses, designs from public contests) with a link back to the site.
-- Only the server (service role) reads these tables; the tokens are stored encrypted.
-- Run in Supabase → SQL Editor, one block at a time. Safe to re-run.

-- Block 1: the one Pinterest connection (a single row).
create table if not exists public.pinterest_connection (
  id boolean primary key default true check (id),
  account_username text,
  access_token_enc text not null,
  refresh_token_enc text,
  access_expires_at timestamptz,
  refresh_expires_at timestamptz,
  scope text,
  board_id text,
  board_name text,
  connected_by uuid references public.profiles(id) on delete set null,
  connected_at timestamptz not null default now(),
  last_error text,
  updated_at timestamptz not null default now()
);
alter table public.pinterest_connection enable row level security;

-- Block 2: every design sent to Pinterest (or tried), once per design and kind.
create table if not exists public.pinterest_pins (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  kind text not null check (kind in ('winner', 'design')),
  status text not null default 'queued' check (status in ('queued', 'posted', 'failed')),
  pin_id text,
  attempts int not null default 0,
  last_error text,
  tried_at timestamptz,
  created_at timestamptz not null default now(),
  posted_at timestamptz,
  unique (entry_id, kind)
);
alter table public.pinterest_pins enable row level security;
create index if not exists pinterest_pins_status_idx on public.pinterest_pins (status, created_at desc);
notify pgrst, 'reload schema';

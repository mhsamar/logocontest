-- logocontest.bd — reports (flags) on designs (owner, 2026-10-08; BLUEPRINT.md §5, §10).
-- Run after 0011 in Supabase → SQL Editor. Safe to re-run.

do $$ begin
  create type public.report_reason as enum ('copied', 'ai', 'trademark', 'contact_info', 'inappropriate', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  -- dismissed_false = the admin found the flag false; the reporter gets a warning.
  create type public.report_status as enum ('open', 'upheld', 'dismissed', 'dismissed_false');
exception when duplicate_object then null; end $$;

-- A flag on one design, for the admin reports queue.
create table if not exists public.reports (
  id                   uuid primary key default gen_random_uuid(),
  reporter_id          uuid not null references public.profiles (id) on delete cascade,
  entry_id             uuid not null references public.entries (id) on delete cascade,
  reason               public.report_reason not null,
  note                 text check (note is null or char_length(note) <= 500),
  evidence_image_path  text,
  evidence_urls        jsonb not null default '[]'::jsonb,
  status               public.report_status not null default 'open',
  resolved_by          uuid references public.profiles (id) on delete set null,
  resolved_at          timestamptz,
  created_at           timestamptz not null default now()
);

-- One open flag per person per design.
create unique index if not exists reports_one_open_per_reporter on public.reports (reporter_id, entry_id) where status = 'open';
create index if not exists reports_queue_idx on public.reports (status, created_at);

-- Server-only table: RLS on, no policies.
alter table public.reports enable row level security;

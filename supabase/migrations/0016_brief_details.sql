-- logocontest.bd — more logo information in the brief (owner, 2026-10-08; BLUEPRINT.md §8.1, UI-JOURNEY C-01, C-02, C-05, C-06).
-- Run after 0015 in Supabase → SQL Editor. Safe to re-run.

alter table public.contests add column if not exists short_name text
  check (short_name is null or char_length(short_name) <= 30);

alter table public.contests add column if not exists target_audience text
  check (target_audience is null or char_length(target_audience) <= 300);

-- Extras the winner must deliver on top of the main logo and the standard files.
alter table public.contests add column if not exists deliverables text[] not null default '{}'
  check (deliverables <@ array['icon_only', 'short_logo', 'versions', 'app_icons']::text[]);

-- Requirements the client ticked on top of the always-on rules (original work, copyright transfer, no AI logos).
alter table public.contests add column if not exists requirements text[] not null default '{}'
  check (requirements <@ array['no_stock', 'home_mockup']::text[]);

alter table public.contests add column if not exists requirements_note text
  check (requirements_note is null or char_length(requirements_note) <= 500);

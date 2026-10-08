-- logocontest.bd — designer portfolio details (owner, 2026-10-08; BLUEPRINT.md §5, P-06, D-12).
-- Run after 0012 in Supabase → SQL Editor. Safe to re-run.

-- Skills and tools are keys from fixed lists (src/lib/designers/portfolio-options.ts)
-- plus at most one free "other" of each, checked by the no-contact filter on the server.
alter table public.profiles add column if not exists skills text[] not null default '{}';
alter table public.profiles add column if not exists tools text[] not null default '{}';
alter table public.profiles add column if not exists experience_years smallint;

do $$ begin
  alter table public.profiles add constraint profiles_experience_years_range check (experience_years is null or experience_years between 0 and 60);
exception when duplicate_object then null; end $$;

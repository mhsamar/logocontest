-- Home showcase (owner, 2026-11-20; Design/logocontest-home-showcase): the home page shows real contests and logos.
-- Two switches for the team: a contest can be kept off the home page, and one design can be hidden from it. Blind,
-- private and NDA contests never show there whatever these say (the app checks that).
-- Down migration: supabase/rollback/0091_home_showcase_down.sql
-- Run in Supabase → SQL Editor, one block at a time.

-- Block 1. The contest switch ("হোমে দেখাবে"), on by default. -----------------------------------------------------
alter table public.contests add column if not exists home_show boolean not null default true;

-- Block 2. The design switch ("hide from home"), off by default. --------------------------------------------------
alter table public.entries add column if not exists home_hidden boolean not null default false;

-- Block 3. Reload the API's list of columns. ----------------------------------------------------------------------
notify pgrst, 'reload schema';

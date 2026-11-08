-- The new brief (owner, 2026-11-08; Design/logocontest-onboarding): the logo name (brand_name, as before) and one text
-- with everything in it, the business category from Admin › Brief, the client's updates to designers, and counts for
-- the team. The older brief columns stay as they are (nothing is dropped), so this can be rolled back.
-- Contests without brief_text show their older brief written out under the 9 headings (done in the code, not here).
-- Down migration: supabase/rollback/0087_brief_text_down.sql
-- Run in Supabase → SQL Editor, one block at a time.

-- Block 1. The brief's new columns on contests. ------------------------------------------------------------------------
alter table public.contests add column if not exists business_category text check (business_category is null or business_category ~ '^[a-z0-9_-]{1,40}$');
alter table public.contests add column if not exists business_category_other text check (business_category_other is null or char_length(business_category_other) <= 600);
alter table public.contests add column if not exists brief_text text check (brief_text is null or char_length(brief_text) <= 60000);
alter table public.contests add column if not exists brief_sections_done smallint check (brief_sections_done is null or brief_sections_done between 0 and 9);
alter table public.contests add column if not exists brief_source text check (brief_source is null or brief_source in ('manual', 'template', 'ai'));
alter table public.contests add column if not exists brief_updated_at timestamptz;

-- Block 2. The client's updates after paying ("আপডেট পাঠান"), newest first. Read and written by the server only. -----
create table if not exists public.brief_updates (
  id          uuid primary key default gen_random_uuid(),
  contest_id  uuid not null references public.contests (id) on delete cascade,
  text        text not null check (char_length(text) between 1 and 8000),
  created_at  timestamptz not null default now()
);
create index if not exists brief_updates_contest_idx on public.brief_updates (contest_id, created_at desc);
alter table public.brief_updates enable row level security;

-- Block 3. Counts for Admin › Brief: who pressed suggest (and for which category), and who finished step 2. ----------
create table if not exists public.brief_events (
  id          uuid primary key default gen_random_uuid(),
  contest_id  uuid not null references public.contests (id) on delete cascade,
  event       text not null check (event in ('suggest', 'step2_complete')),
  category    text check (category is null or category ~ '^[a-z0-9_-]{1,40}$'),
  created_at  timestamptz not null default now()
);
create index if not exists brief_events_event_idx on public.brief_events (event, created_at desc);
alter table public.brief_events enable row level security;

-- Rolls back 0087_brief_text.sql. The older brief columns were never changed, so contests show their older brief again.
-- Run only after the code that reads these columns is rolled back (or Admin › Brief › New brief is switched off).
drop table if exists public.brief_events;
drop table if exists public.brief_updates;
alter table public.contests drop column if exists brief_updated_at;
alter table public.contests drop column if exists brief_source;
alter table public.contests drop column if exists brief_sections_done;
alter table public.contests drop column if exists brief_text;
alter table public.contests drop column if exists business_category_other;
alter table public.contests drop column if exists business_category;

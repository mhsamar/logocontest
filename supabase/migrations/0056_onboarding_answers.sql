-- Onboarding the owner controls (owner, 2026-10-14): the answers to the owner's own questions (Admin › Onboarding).
-- A client's answers are kept with the contest (designers see them in the brief); a designer's with the profile
-- (admins see them on the user page). The questions themselves are a settings row per flow. Safe to re-run.
-- Down migration: supabase/rollback/0056_onboarding_answers_down.sql
alter table public.contests add column if not exists extra_answers jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists onboarding_answers jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';

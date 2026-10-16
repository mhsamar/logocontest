-- logocontest.bd — premium client workspace (owner, 2026-10-16; Design/client-premium, CLIENT-HANDOFF §6).
-- "Show my profile to designers": when a client turns it off, their public profile (/c/username) is private.
-- Run in Supabase → SQL Editor. Safe to re-run.

alter table public.profiles add column if not exists profile_hidden boolean not null default false;

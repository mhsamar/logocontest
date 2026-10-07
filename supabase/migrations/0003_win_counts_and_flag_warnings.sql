-- logocontest.bd — owner decisions of 2026-10-07 (BLUEPRINT.md §5, §7.2, §10).
-- Run after 0002 in Supabase → SQL Editor. Safe to re-run.

alter table public.profiles
  -- Wins that count toward fee tiers and the leaderboard (wins_count = all wins, shown on the profile).
  add column if not exists counted_wins_count int not null default 0,
  -- Warnings for false copy flags; 3 = ban (setting limits.false_flag_warnings_for_ban).
  add column if not exists flag_warnings int not null default 0;

do $$ begin
  alter table public.profiles add constraint profiles_win_flag_counts_non_negative
    check (counted_wins_count >= 0 and flag_warnings >= 0 and counted_wins_count <= wins_count);
exception when duplicate_object then null; end $$;

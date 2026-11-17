-- Undo 0090_reopen_contest.sql (contests already reopened stay open).
drop function if exists public.admin_reopen_contest(uuid, int);

-- Rollback of 0081: the bounce and complaint list goes (the site then emails those addresses again).
-- Run in Supabase → SQL Editor.

drop table if exists public.email_suppressions;

-- Undo 0086_remove_copied_winner.sql (winners already changed with it stay as they are).
drop function if exists public.admin_remove_copied_winner(uuid, int, boolean);

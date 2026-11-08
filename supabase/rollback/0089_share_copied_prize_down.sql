-- Undo 0089_share_copied_prize.sql (prizes already shared with it stay shared).
drop function if exists public.admin_share_copied_prize(uuid, jsonb);

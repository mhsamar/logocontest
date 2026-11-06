-- Undo 0085_award_after_no_result.sql (winners already picked with it stay as they are).
drop function if exists public.admin_award_no_result(uuid, uuid, int, timestamptz, boolean);

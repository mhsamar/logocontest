-- Rollback of 0078: follow-ups forget "Remind me by" and which due / overdue alerts were sent (the team may get one
-- more alert for a follow-up already alerted). Run in Supabase → SQL Editor.

alter table public.unpaid_leads
  drop column if exists remind_by,
  drop column if exists due_alerted_for,
  drop column if exists overdue_alerted_for;

notify pgrst, 'reload schema';

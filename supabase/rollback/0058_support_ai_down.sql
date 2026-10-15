-- Undo 0058: removes the assistant's columns and function (its messages stay, shown as from the team).
drop function if exists public.post_ai_message(uuid, text);
drop index if exists public.support_threads_mode_idx;
alter table public.support_threads
  drop column if exists mode,
  drop column if exists assigned_to,
  drop column if exists assigned_at,
  drop column if exists handed_over_at,
  drop column if exists handover_reason;
alter table public.support_messages drop column if exists is_ai;
delete from public.settings where key in ('support.ai_enabled', 'support.ai_daily_limit');

notify pgrst, 'reload schema';

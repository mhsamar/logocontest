-- 0058 AI support assistant (owner, 2026-10-15): the assistant answers first; when a person is needed the chat waits
-- for the team, a staff member takes it ("Assign to me" or assigns a colleague) and chats.
-- mode: 'ai' = the assistant answers, 'waiting' = handed to the team, nobody assigned yet, 'human' = a staff member has it.
alter table public.support_threads
  add column if not exists mode text not null default 'ai' check (mode in ('ai', 'waiting', 'human')),
  add column if not exists assigned_to uuid references public.profiles (id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists handed_over_at timestamptz,
  add column if not exists handover_reason text check (handover_reason is null or char_length(handover_reason) <= 300);
create index if not exists support_threads_mode_idx on public.support_threads (mode, assigned_to);

-- The assistant's messages (shown as "AI assistant").
alter table public.support_messages add column if not exists is_ai boolean not null default false;

-- Conversations a staff member answered in the last 7 days stay with the team.
update public.support_threads t set mode = 'human'
 where exists (select 1 from public.support_messages m where m.thread_id = t.id and m.from_admin and m.broadcast_id is null and m.created_at > now() - interval '7 days');

-- One message from the assistant. Returns its id.
create or replace function public.post_ai_message(p_thread uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.support_messages (thread_id, sender_id, from_admin, body, is_ai)
  values (p_thread, null, true, p_body, true)
  returning id into v_id;
  update public.support_threads
     set last_message_at = now(), last_from_admin = true, unread_by_user = unread_by_user + 1
   where id = p_thread;
  return v_id;
end;
$$;
revoke execute on function public.post_ai_message(uuid, text) from public, anon, authenticated;

notify pgrst, 'reload schema';

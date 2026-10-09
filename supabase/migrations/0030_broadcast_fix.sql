-- logocontest.bd — fix for broadcast_message (0029). Run after 0029. Safe to re-run.
-- Supabase refuses "delete" without a where clause (safe-update guard), even on the function's own
-- temporary table, so the list of recipients is emptied with truncate instead.

-- An admin's message to a group (or one person): one row in broadcasts, a message in each
-- recipient's conversation. Banned accounts and staff are skipped. Returns the broadcast id.
create or replace function public.broadcast_message(p_admin uuid, p_audience text, p_target uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_count int;
begin
  insert into public.broadcasts (admin_id, audience, target_user, body)
  values (p_admin, p_audience, p_target, p_body)
  returning id into v_id;

  create temp table if not exists _broadcast_targets (user_id uuid primary key) on commit drop;
  truncate _broadcast_targets;
  insert into _broadcast_targets (user_id)
  select id from public.profiles
   where status <> 'banned'
     and (   (p_audience = 'designers' and role = 'designer')
          or (p_audience = 'clients'   and role = 'client')
          or (p_audience = 'everyone'  and role in ('designer', 'client'))
          or (p_audience = 'one'       and id = p_target and role in ('designer', 'client')));

  insert into public.support_threads (user_id) select user_id from _broadcast_targets
  on conflict (user_id) do nothing;

  insert into public.support_messages (thread_id, sender_id, from_admin, body, broadcast_id)
  select t.id, p_admin, true, p_body, v_id
    from public.support_threads t join _broadcast_targets b on b.user_id = t.user_id;
  get diagnostics v_count = row_count;

  update public.support_threads t
     set status = 'open', last_message_at = now(), last_from_admin = true, unread_by_user = t.unread_by_user + 1
    from _broadcast_targets b where b.user_id = t.user_id;

  update public.broadcasts set recipients = v_count where id = v_id;
  return v_id;
end;
$$;

revoke execute on function public.broadcast_message(uuid, text, uuid, text) from public, anon, authenticated;

notify pgrst, 'reload schema';

-- logocontest.bd — Admin panel 2.0 (owner, 2026-10-09; BLUEPRINT §13.2, milestone 13).
-- Run after 0028 in Supabase → SQL Editor. Safe to re-run.
-- Only the server (service role) reads and writes the new tables: row level security is on and
-- there are no policies. Users can't update profiles directly (no update policy), so the new
-- staff columns can only be changed by the server.

-- 1. Super admin and staff permissions --------------------------------------------------------
alter table public.profiles add column if not exists is_super_admin boolean not null default false;
alter table public.profiles add column if not exists admin_title text check (admin_title is null or char_length(admin_title) <= 40);
alter table public.profiles add column if not exists admin_permissions text[] not null default '{}';
alter table public.profiles add column if not exists admin_active boolean not null default true;

-- The admin accounts that exist today were made by the owner with `npm run seed`: they are the Super admin.
update public.profiles set is_super_admin = true where role = 'admin' and not is_super_admin;

-- 2. Page views (no IP addresses; 180 days kept) ------------------------------------------------
create table if not exists public.page_views (
  id          bigint generated always as identity primary key,
  visitor_id  uuid not null,
  user_id     uuid references public.profiles(id) on delete set null,
  path        text not null check (char_length(path) <= 300),
  referrer    text check (referrer is null or char_length(referrer) <= 300),
  device      text not null check (device in ('mobile', 'tablet', 'desktop')),
  country     text check (country is null or country ~ '^[A-Z]{2}$'),
  created_at  timestamptz not null default now()
);
create index if not exists page_views_created_idx on public.page_views (created_at desc);
create index if not exists page_views_visitor_idx on public.page_views (visitor_id, created_at desc);
alter table public.page_views enable row level security;

-- 3. Who is on the site now (one row per visitor, refreshed every 30 seconds) -----------------
create table if not exists public.presence (
  visitor_id  uuid primary key,
  user_id     uuid references public.profiles(id) on delete cascade,
  path        text not null check (char_length(path) <= 300),
  device      text not null check (device in ('mobile', 'tablet', 'desktop')),
  country     text check (country is null or country ~ '^[A-Z]{2}$'),
  started_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists presence_updated_idx on public.presence (updated_at desc);
alter table public.presence enable row level security;

-- 4. Support chat: one conversation per user -----------------------------------------------------
create table if not exists public.support_threads (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references public.profiles(id) on delete cascade,
  status           text not null default 'open' check (status in ('open', 'closed')),
  last_message_at  timestamptz not null default now(),
  last_from_admin  boolean not null default false,
  unread_by_user   int not null default 0,
  unread_by_admin  int not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists support_threads_list_idx on public.support_threads (status, last_message_at desc);
alter table public.support_threads enable row level security;

create table if not exists public.broadcasts (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid references public.profiles(id) on delete set null,
  audience     text not null check (audience in ('designers', 'clients', 'everyone', 'one')),
  target_user  uuid references public.profiles(id) on delete set null,
  body         text not null check (char_length(body) between 1 and 4000),
  recipients   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists broadcasts_created_idx on public.broadcasts (created_at desc);
alter table public.broadcasts enable row level security;

create table if not exists public.support_messages (
  id            uuid primary key default gen_random_uuid(),
  thread_id     uuid not null references public.support_threads(id) on delete cascade,
  sender_id     uuid references public.profiles(id) on delete set null,
  from_admin    boolean not null,
  body          text not null check (char_length(body) between 1 and 4000),
  broadcast_id  uuid references public.broadcasts(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists support_messages_thread_idx on public.support_messages (thread_id, created_at);
alter table public.support_messages enable row level security;

-- One message in a user's conversation (the thread is made if needed). Returns the thread id.
create or replace function public.post_support_message(p_user uuid, p_sender uuid, p_from_admin boolean, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread uuid;
begin
  insert into public.support_threads (user_id) values (p_user)
  on conflict (user_id) do nothing;
  select id into v_thread from public.support_threads where user_id = p_user for update;

  insert into public.support_messages (thread_id, sender_id, from_admin, body)
  values (v_thread, p_sender, p_from_admin, p_body);

  update public.support_threads
     set status = 'open',
         last_message_at = now(),
         last_from_admin = p_from_admin,
         unread_by_user  = case when p_from_admin then unread_by_user + 1 else unread_by_user end,
         unread_by_admin = case when p_from_admin then unread_by_admin else unread_by_admin + 1 end
   where id = v_thread;
  return v_thread;
end;
$$;

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

revoke execute on function public.post_support_message(uuid, uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.broadcast_message(uuid, text, uuid, text) from public, anon, authenticated;

notify pgrst, 'reload schema';

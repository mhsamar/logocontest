-- 0063 Usernames (owner, 2026-10-15): every client and designer has a fixed username they can also log in with. Only
-- Pro designers can change theirs, once every 60 days. Old usernames are kept here, so old profile links still lead
-- to the person and nobody else can take the name.

-- Block 1
create table if not exists public.username_history (
  old_username  text primary key check (old_username = lower(old_username) and char_length(old_username) between 2 and 60),
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  changed_at    timestamptz not null default now()
);
create index if not exists username_history_profile_idx on public.username_history (profile_id, changed_at desc);
alter table public.username_history enable row level security;

-- Block 2
alter table public.profiles add column if not exists username_changed_at timestamptz;
notify pgrst, 'reload schema';

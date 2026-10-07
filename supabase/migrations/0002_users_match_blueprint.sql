-- logocontest.bd — align public.profiles with BLUEPRINT.md §5 "users".
-- Run after 0001 in Supabase → SQL Editor. Safe to re-run.
--
-- BLUEPRINT "users" maps to two tables in Supabase:
--   auth.users      → password (and the internal login address)
--   public.profiles → everything else below

-- phone → mobile, phone_verified_at → mobile_verified_at
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles' and column_name = 'phone') then
    alter table public.profiles rename column phone to mobile;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles' and column_name = 'phone_verified_at') then
    alter table public.profiles rename column phone_verified_at to mobile_verified_at;
  end if;
end $$;

alter table public.profiles
  add column if not exists username      text,
  add column if not exists email         text,
  add column if not exists avatar_path   text,
  add column if not exists bio           text,
  add column if not exists business_name text,
  add column if not exists strikes       int not null default 0,
  add column if not exists wins_count    int not null default 0;

do $$ begin
  alter table public.profiles add constraint profiles_username_key unique (username);
exception when duplicate_table or duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_bio_length check (bio is null or char_length(bio) <= 300);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_counts_non_negative check (strikes >= 0 and wins_count >= 0);
exception when duplicate_object then null; end $$;

-- Role is never taken from user input: every account starts as "client"
-- (designer signup in D-01 sets the role server-side).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, mobile, name, email, locale, mobile_verified_at)
  values (
    new.id,
    new.raw_user_meta_data ->> 'mobile',
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), 'User'),
    nullif(trim(new.raw_user_meta_data ->> 'email'), ''),
    coalesce(new.raw_user_meta_data ->> 'locale', 'en'),
    now()
  );
  return new;
end;
$$;

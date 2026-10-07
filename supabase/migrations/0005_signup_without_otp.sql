-- logocontest.bd — sign-up without SMS OTP (owner, 2026-10-07; BLUEPRINT.md §4, §5).
-- Accounts now sign up with mobile + email + password. Run after 0004. Safe to re-run.

-- One email = one account (case-insensitive). Existing rows without email are allowed.
create unique index if not exists profiles_email_unique on public.profiles (lower(email)) where email is not null;

-- The mobile number is no longer verified by OTP, so it is not marked verified at sign-up.
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
    nullif(lower(trim(new.raw_user_meta_data ->> 'email')), ''),
    coalesce(new.raw_user_meta_data ->> 'locale', 'en'),
    null
  );
  return new;
end;
$$;

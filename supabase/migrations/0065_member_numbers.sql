-- 0065 Account numbers (owner, 2026-10-17): every client and every designer gets a number in its group, in sign-up
-- order, and the username is the first name + that number (anika010, das008). The number shows how many clients
-- and designers have joined. Run in Supabase → SQL Editor, one block at a time. Safe to re-run.

-- Block 1: the number on each profile; one number per group.
alter table public.profiles add column if not exists member_no int;
create unique index if not exists profiles_role_member_no_idx on public.profiles (role, member_no) where member_no is not null;

-- Block 2: hands out the next number of the profile's group, one at a time (two sign-ups never get the same one).
create or replace function public.assign_member_no(p_profile uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_no int;
begin
  select role::text, member_no into v_role, v_no from public.profiles where id = p_profile;
  if v_role is null then return null; end if;
  if v_no is not null then return v_no; end if;
  perform pg_advisory_xact_lock(hashtext('member_no:' || v_role));
  select coalesce(max(member_no), 0) + 1 into v_no from public.profiles where role::text = v_role;
  update public.profiles set member_no = v_no where id = p_profile;
  return v_no;
end;
$$;
revoke all on function public.assign_member_no(uuid) from public, anon, authenticated;
notify pgrst, 'reload schema';

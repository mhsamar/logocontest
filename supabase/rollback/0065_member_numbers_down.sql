-- Undo 0065 (account numbers). Usernames already given stay as they are.
drop function if exists public.assign_member_no(uuid);
drop index if exists public.profiles_role_member_no_idx;
alter table public.profiles drop column if exists member_no;
notify pgrst, 'reload schema';

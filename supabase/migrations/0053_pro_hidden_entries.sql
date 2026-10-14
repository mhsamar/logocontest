-- Pro "Hide my design" (owner, 2026-10-14): a Pro designer can hide a design so only the contest's client (and
-- admins) see the picture; other designers and visitors see a locked card. Once the winner is picked (the contest
-- leaves open / judging) every design is public. Admin > Pro plan can switch the feature off.
-- Down migration: supabase/rollback/0053_pro_hidden_entries_down.sql
alter table public.entries add column if not exists is_hidden boolean not null default false;
alter table public.pro_settings add column if not exists f_hidden_entries boolean not null default true;

notify pgrst, 'reload schema';

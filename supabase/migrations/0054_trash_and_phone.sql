-- Trash, and mobile numbers from any country (owner, 2026-10-14).
--
-- Trash: an admin's "Delete" moves a contest or a user to the Trash (status 'deleted'); it can be restored for 90 days
-- and is then erased for good by the lifecycle job (Settings → trash.keep_days). A contest still unpaid 72 hours after
-- it was started goes to the Trash on its own (trash.unpaid_hours). The status before deleting is kept for Restore.
--
-- Phone: sign-up asks for a country (Bangladesh first); mobiles are kept in international form (+<country><number>).
-- "This number is on WhatsApp" is saved with the profile.
--
-- Run the four blocks one at a time (a new enum value can't be used in the block that adds it).
-- Down migration: supabase/rollback/0054_trash_and_phone_down.sql

-- ---- Block 1: the new statuses ---------------------------------------------------------------------------------
alter type public.contest_status add value if not exists 'deleted';
alter type public.user_status add value if not exists 'deleted';

-- ---- Block 2: who deleted it, when, why, and the status to restore ---------------------------------------------
alter table public.contests
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles (id) on delete set null,
  add column if not exists delete_reason text check (delete_reason is null or char_length(delete_reason) <= 500),
  add column if not exists deleted_from_status public.contest_status;
alter table public.profiles
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles (id) on delete set null,
  add column if not exists delete_reason text check (delete_reason is null or char_length(delete_reason) <= 500),
  add column if not exists deleted_from_status public.user_status;
create index if not exists contests_deleted_idx on public.contests (deleted_at) where deleted_at is not null;
create index if not exists profiles_deleted_idx on public.profiles (deleted_at) where deleted_at is not null;

-- ---- Block 3: a deleted draft has no dates --------------------------------------------------------------------
alter table public.contests drop constraint if exists contests_live_has_dates;
alter table public.contests add constraint contests_live_has_dates
  check (status in ('draft', 'pending_payment', 'cancelled', 'deleted') or (starts_at is not null and ends_at is not null));

-- ---- Block 4: mobiles from any country, and WhatsApp -----------------------------------------------------------
do $$
declare c record;
begin
  -- The old Bangladesh-only checks (whatever their names are now).
  for c in select conrelid::regclass as tbl, conname from pg_constraint
           where contype = 'c' and conrelid in ('public.profiles'::regclass, 'public.wizard_leads'::regclass)
             and pg_get_constraintdef(oid) like '%8801%'
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;
alter table public.profiles drop constraint if exists profiles_mobile_e164;
alter table public.profiles add constraint profiles_mobile_e164 check (mobile ~ '^\+[1-9][0-9]{6,14}$');
alter table public.wizard_leads drop constraint if exists wizard_leads_mobile_e164;
alter table public.wizard_leads add constraint wizard_leads_mobile_e164 check (mobile ~ '^\+[1-9][0-9]{6,14}$');
alter table public.profiles add column if not exists whatsapp boolean not null default false;

notify pgrst, 'reload schema';

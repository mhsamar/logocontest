-- Undo 0054. Restore everything from the Trash first (Admin › Trash): deleted rows go back to the status they had.
-- Postgres can't remove a value from an enum, so the 'deleted' statuses stay (unused).

update public.contests set status = coalesce(deleted_from_status, 'draft'), deleted_at = null where status = 'deleted';
update public.profiles set status = coalesce(deleted_from_status, 'active'), deleted_at = null where status = 'deleted';

alter table public.contests drop constraint if exists contests_live_has_dates;
alter table public.contests add constraint contests_live_has_dates
  check (status in ('draft', 'pending_payment', 'cancelled') or (starts_at is not null and ends_at is not null));

alter table public.contests
  drop column if exists deleted_at,
  drop column if exists deleted_by,
  drop column if exists delete_reason,
  drop column if exists deleted_from_status;
alter table public.profiles
  drop column if exists deleted_at,
  drop column if exists deleted_by,
  drop column if exists delete_reason,
  drop column if exists deleted_from_status,
  drop column if exists whatsapp;

-- Only works while every mobile is a Bangladesh number.
alter table public.profiles drop constraint if exists profiles_mobile_e164;
alter table public.profiles add constraint profiles_phone_check check (mobile ~ '^\+8801[3-9][0-9]{8}$');
alter table public.wizard_leads drop constraint if exists wizard_leads_mobile_e164;
alter table public.wizard_leads add constraint wizard_leads_mobile_check check (mobile ~ '^\+8801[3-9][0-9]{8}$');

notify pgrst, 'reload schema';

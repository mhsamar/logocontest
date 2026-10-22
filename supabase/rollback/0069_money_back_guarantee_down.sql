-- Undo 0069 (money-back guarantee). Only before go-live: it deletes every claim and every contest's promise.
drop trigger if exists contests_guarantee_freeze on public.contests;
drop trigger if exists contests_guarantee_stamp on public.contests;
drop function if exists public.decide_guarantee_claim(uuid, uuid, boolean, text, text, jsonb, int);
drop function if exists public.open_guarantee_claim(uuid, uuid, text, text, boolean);
drop function if exists public.guarantee_freeze();
drop function if exists public.guarantee_stamp();
drop function if exists public.guarantee_paid(uuid);
drop function if exists public.guarantee_designer_ids(uuid, boolean);
drop table if exists public.guarantee_claims;
alter table public.contests drop column if exists guarantee_designers;
delete from public.settings where key in ('guarantee.enabled', 'guarantee.min_designers', 'guarantee.late_days');
notify pgrst, 'reload schema';

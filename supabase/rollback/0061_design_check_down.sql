-- Undo 0061. Held designs are published first (Postgres can't drop one value from an enum, so 'held' stays unused).
update public.entries set status = 'active' where status = 'held';
drop index if exists public.entries_held_idx;
alter table public.entries drop constraint if exists entries_held_reason_len;
alter table public.entries drop column if exists held_positions;
alter table public.entries drop column if exists held_reason;
alter table public.entries drop column if exists held_at;

notify pgrst, 'reload schema';

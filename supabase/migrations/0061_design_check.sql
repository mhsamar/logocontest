-- 0061 Design check (owner, 2026-10-15): when a new design doesn't look like a design for the contest (an app
-- screenshot, a random photo, a text note…), it is held for Admin › Designs › To approve instead of being published.
-- Run block 1 on its own first: Postgres can't use a new enum value in the same run that adds it.

-- Block 1
alter type public.entry_status add value if not exists 'held';

-- Block 2
alter table public.entries add column if not exists held_at timestamptz;
alter table public.entries add column if not exists held_reason text;
alter table public.entries add column if not exists held_positions smallint[];
alter table public.entries drop constraint if exists entries_held_reason_len;
alter table public.entries add constraint entries_held_reason_len check (held_reason is null or char_length(held_reason) <= 500);
create index if not exists entries_held_idx on public.entries (held_at) where status = 'held';

notify pgrst, 'reload schema';

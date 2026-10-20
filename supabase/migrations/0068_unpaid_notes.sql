-- 0068 Unpaid contest call notes (owner, 2026-10-20): what the client said when the team called or messaged about an
-- unpaid contest (posted by mistake, will pay later, wants to start again…), with a short note. Admin › Unpaid contests.
-- Only the server reads it. Run in Supabase → SQL Editor. Safe to re-run.

create table if not exists public.unpaid_notes (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  admin_id uuid references public.profiles(id) on delete set null,
  outcome text not null check (outcome in ('mistake', 'later', 'restart', 'help', 'price', 'no_answer', 'not_interested', 'other')),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);
alter table public.unpaid_notes enable row level security;
create index if not exists unpaid_notes_contest_idx on public.unpaid_notes (contest_id, created_at desc);
notify pgrst, 'reload schema';

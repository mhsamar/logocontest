-- 0076 Unpaid contests: follow-ups (owner, 2026-10-25; Design/unpaid-contests). Everyone who started a contest but
-- didn't pay becomes a lead the team can call, note, plan the next follow-up for, and close (also "as fake", which can
-- block the phone or email from new contests). Nothing here is deleted when a draft is: a lead keeps its own copy of the
-- brand and amount. Only the server reads or writes these tables (RLS on, no policies). Clients never see them.
-- Run in Supabase → SQL Editor, ONE BLOCK AT A TIME, in order. Every block is safe to re-run.

-- ---- Block 1: one row per lead ----------------------------------------------------------------------------------------
-- A lead is an unpaid draft (contest_id) or a guest who only left a mobile number on the first step (guest_mobile).
create table if not exists public.unpaid_leads (
  id                 uuid primary key default gen_random_uuid(),
  kind               text not null check (kind in ('contest', 'guest')),
  contest_id         uuid unique references public.contests (id) on delete set null,
  guest_mobile       text unique check (guest_mobile is null or char_length(guest_mobile) <= 20),
  client_id          uuid references public.profiles (id) on delete set null,
  brand_snapshot     text check (brand_snapshot is null or char_length(brand_snapshot) <= 200),
  amount_snapshot    integer,
  status             text not null default 'new' check (status in ('new', 'in_touch', 'promised', 'needs_help', 'not_reachable', 'closed')),
  closed_reason      text check (closed_reason is null or closed_reason in ('not_interested', 'paid_other', 'fake')),
  fake_reason        text check (fake_reason is null or fake_reason in ('test', 'fake_identity', 'spam', 'copy', 'other')),
  close_note         text check (close_note is null or char_length(close_note) <= 500),
  closed_at          timestamptz,
  closed_by          uuid references public.profiles (id) on delete set null,
  hidden             boolean not null default false,
  blocked            boolean not null default false,
  stop_reminders     boolean not null default false,
  owner_id           uuid references public.profiles (id) on delete set null,
  next_followup_at   timestamptz,
  next_followup_type text check (next_followup_type is null or next_followup_type in ('call', 'whatsapp', 'sms', 'email', 'note')),
  contacts_count     integer not null default 0,
  last_contact_at    timestamptz,
  last_contact_type  text,
  last_result        text,
  no_answer_streak   smallint not null default 0,
  reopened_at        timestamptz,
  reopened_by        uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check ((kind = 'contest') = (guest_mobile is null))
);
create index if not exists unpaid_leads_next_idx on public.unpaid_leads (next_followup_at) where status <> 'closed';
alter table public.unpaid_leads enable row level security;

-- ---- Block 2: what the team did, newest first in the lead's History ----------------------------------------------------
create table if not exists public.lead_activities (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid not null references public.unpaid_leads (id) on delete cascade,
  admin_id       uuid references public.profiles (id) on delete set null,
  kind           text not null check (kind in ('call', 'whatsapp', 'sms', 'email', 'note', 'system')),
  result         text check (result is null or result in ('talked', 'no_answer', 'busy', 'wrong_number', 'will_pay', 'needs_help', 'not_interested', 'fake')),
  event          text check (event is null or char_length(event) <= 40),
  note           text check (note is null or char_length(note) <= 1000),
  next_followup_at timestamptz,
  -- The planned follow-up this one carried out ("Follow-ups today: done").
  completes_at   timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists lead_activities_lead_idx on public.lead_activities (lead_id, created_at desc);
create index if not exists lead_activities_done_idx on public.lead_activities (created_at) where completes_at is not null;
alter table public.lead_activities enable row level security;

-- ---- Block 3: phones and emails that may not start new contests (Close as fake → Block) --------------------------------
create table if not exists public.blocked_contacts (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('mobile', 'email')),
  value       text not null check (char_length(value) <= 254),
  lead_id     uuid references public.unpaid_leads (id) on delete set null,
  reason      text check (reason is null or char_length(reason) <= 500),
  blocked_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  lifted_at   timestamptz,
  lifted_by   uuid references public.profiles (id) on delete set null
);
-- One live row per lead that asked for the block, so reopening one lead never lifts another lead's block.
create unique index if not exists blocked_contacts_live_idx on public.blocked_contacts (kind, value, lead_id) where lifted_at is null;
create index if not exists blocked_contacts_value_idx on public.blocked_contacts (value) where lifted_at is null;
alter table public.blocked_contacts enable row level security;

-- Check: select count(*) from public.unpaid_leads; select count(*) from public.lead_activities; select count(*) from public.blocked_contacts;

notify pgrst, 'reload schema';

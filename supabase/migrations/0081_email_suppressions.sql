-- Amazon SES bounces and spam complaints (owner, 2026-11-01): an address that bounced for good, or whose owner marked
-- our email as spam, gets no more email from the site (by SES or by Resend). AWS reports them to
-- /api/email/ses-events; the site checks this list before every email except login codes.
-- Down migration: supabase/rollback/0081_email_suppressions_down.sql
-- Run in Supabase → SQL Editor, one block at a time.

-- Block 1. The list (lower-case addresses). ------------------------------------------------------------------------
create table if not exists public.email_suppressions (
  email       text primary key check (email = lower(email) and char_length(email) <= 254),
  reason      text not null check (reason in ('bounce', 'complaint')),
  detail      text check (detail is null or char_length(detail) <= 300),
  created_at  timestamptz not null default now()
);

-- Block 2. Only the server (service role) reads and writes it. ------------------------------------------------------
alter table public.email_suppressions enable row level security;

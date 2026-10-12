-- Visitor welcome pop-up (owner, 2026-10-13; Design/visitor-popup/VISITOR-POPUP-HANDOFF.md).
-- Anonymous pop-up events (event name, a random id made in the browser, time; no name, email, IP or user id) and
-- where a new account came from. The settings (popup.on, popup.seconds, popup.snooze_days) use their defaults
-- until an admin changes them.

-- 1. Events: only the server (service role) reads and writes them; RLS on with no policies keeps everyone else out.
create table if not exists public.popup_events (
  id bigint generated always as identity primary key,
  visitor_id uuid not null,
  event text not null check (event in ('popup_shown', 'popup_click_client', 'popup_click_designer', 'popup_closed', 'popup_never')),
  created_at timestamptz not null default now()
);
create index if not exists popup_events_created_at_idx on public.popup_events (created_at);
alter table public.popup_events enable row level security;

-- 2. Where a new account came from ("popup" when the sign-up started from a pop-up button).
alter table public.profiles add column if not exists signup_source text check (signup_source is null or signup_source ~ '^[a-z_]{1,20}$');

notify pgrst, 'reload schema';

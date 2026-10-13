-- Designer Pro plan: 3-day free Pro Trial (owner, 2026-10-14).
-- A designer who never had Pro or a trial taps "Start free trial" and gets Pro for 3 days without paying, with two
-- limits: 10 logo checks and 10 portfolio images for the whole trial. One trial per account for life (one row per
-- designer). On the last day they are reminded; then the trial ends and they are Basic again unless they paid.
-- Off until the owner turns it on in Admin > Pro plan (online payments are not open yet).
-- Down migration: supabase/rollback/0048_pro_trial_down.sql

-- 1. Settings (Admin > Pro plan) ---------------------------------------------------------------------
alter table public.pro_settings add column if not exists free_trial_enabled boolean not null default false;
alter table public.pro_settings add column if not exists free_trial_days smallint not null default 3;
alter table public.pro_settings add column if not exists trial_logo_checks int not null default 10;
alter table public.pro_settings add column if not exists trial_portfolio_limit int not null default 10;
alter table public.pro_settings drop constraint if exists pro_settings_free_trial_ranges;
alter table public.pro_settings add constraint pro_settings_free_trial_ranges
  check (free_trial_days between 1 and 30 and trial_logo_checks between 0 and 1000 and trial_portfolio_limit between 0 and 1000);

-- 2. Trials: one per designer, ever ----------------------------------------------------------------------
create table if not exists public.pro_trials (
  id                  uuid primary key default gen_random_uuid(),
  designer_id         uuid not null unique references public.profiles (id) on delete cascade,
  status              text not null default 'active' check (status in ('active', 'expired', 'upgraded', 'cancelled')),
  started_at          timestamptz not null default now(),
  ends_at             timestamptz not null,
  started_by          text not null default 'designer' check (started_by in ('designer', 'admin')),
  started_by_admin    uuid references public.profiles (id) on delete set null,
  extended_days       int not null default 0 check (extended_days >= 0),
  reminded_at         timestamptz,
  ended_at            timestamptz,
  cancelled_by        text check (cancelled_by is null or cancelled_by in ('designer', 'admin')),
  upgraded_at         timestamptz,
  upgrade_payment_id  uuid references public.pro_payments (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (ends_at > started_at)
);
create index if not exists pro_trials_status_idx on public.pro_trials (status, ends_at);
alter table public.pro_trials enable row level security;
drop policy if exists pro_trials_read on public.pro_trials;
create policy pro_trials_read on public.pro_trials for select using (designer_id = auth.uid() or public.admin_can('pro.view'));

-- 3. What happened to each trial (started, reminded, extended, cancelled, expired, upgraded) --------------
create table if not exists public.pro_trial_events (
  id           uuid primary key default gen_random_uuid(),
  trial_id     uuid not null references public.pro_trials (id) on delete cascade,
  designer_id  uuid not null references public.profiles (id) on delete cascade,
  kind         text not null check (kind in ('started', 'reminded', 'extended', 'cancelled', 'expired', 'upgraded')),
  actor_id     uuid references public.profiles (id) on delete set null,
  detail       jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists pro_trial_events_trial_idx on public.pro_trial_events (trial_id, created_at desc);
alter table public.pro_trial_events enable row level security;
drop policy if exists pro_trial_events_read on public.pro_trial_events;
create policy pro_trial_events_read on public.pro_trial_events for select using (designer_id = auth.uid() or public.admin_can('pro.view'));

notify pgrst, 'reload schema';

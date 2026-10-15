-- 0057 Emails (owner, 2026-10-15): the designed email templates.
-- 1. Every email the site sends is logged: who, which template, sent / failed / skipped, Resend's message id.
create table if not exists public.email_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles (id) on delete set null,
  template    text not null,
  ref         text,
  security    boolean not null default false,
  status      text not null check (status in ('sent', 'failed', 'skipped')),
  reason      text,
  provider_id text,
  attempts    int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists email_log_user_template_idx on public.email_log (user_id, template, created_at desc);
create index if not exists email_log_created_idx on public.email_log (created_at desc);
-- Only the server (service role) reads and writes it.
alter table public.email_log enable row level security;

-- 2. The emails a person turned off (Email settings or the Unsubscribe link in an email).
alter table public.profiles add column if not exists email_off text[] not null default '{}';

-- 3. Email codes work for 10 minutes (was 30).
update public.settings set value = '10'::jsonb, updated_at = now() where key = 'auth.email_code_ttl_minutes';

notify pgrst, 'reload schema';

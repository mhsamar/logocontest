-- Designer Pro plan (owner, 2026-10-13; Design/pro/PRO-HANDOFF.md). A monthly subscription for designers, run from
-- Admin › Pro plan. Basic designers keep working as before, with the limits in pro_settings (5 designs per contest,
-- 2 logo checks a month). Only the server (service role) writes these tables; signed-in people read their own rows,
-- and admins with the Pro plan permission read and write everything. Undo: supabase/rollback/0046_pro_plan_down.sql.

-- 0. Admin permission check for the policies below ("pro.view" is also met by "pro.manage").
create or replace function public.admin_can(p_perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
       and (p.is_super_admin or (p.admin_active and p.admin_permissions && array[p_perm, replace(p_perm, '.view', '.manage')]))
  );
$$;

-- 1. The plan settings: one row, changed in Admin › Pro plan. Everyone may read them (the price is public).
create table if not exists public.pro_settings (
  id                        smallint primary key default 1 check (id = 1),
  is_for_sale               boolean not null default false,
  price_bdt                 int not null default 500 check (price_bdt between 1 and 100000),
  offer_enabled             boolean not null default false,
  offer_price_bdt           int check (offer_price_bdt is null or offer_price_bdt between 0 and 100000),
  offer_audience            text not null default 'new' check (offer_audience in ('new', 'all')),
  offer_starts_at           timestamptz,
  offer_ends_at             timestamptz,
  trial_days                int not null default 0 check (trial_days between 0 and 90),
  promo_code                text check (promo_code is null or promo_code ~ '^[A-Z0-9]{3,20}$'),
  promo_price_bdt           int check (promo_price_bdt is null or promo_price_bdt between 0 and 100000),
  pro_logo_checks           int not null default 100 check (pro_logo_checks between 0 and 10000),
  basic_logo_checks         int not null default 2 check (basic_logo_checks between 0 and 10000),
  pro_portfolio_limit       int not null default 50 check (pro_portfolio_limit between 0 and 1000),
  pro_entries_per_contest   int check (pro_entries_per_contest is null or pro_entries_per_contest between 1 and 1000),
  basic_entries_per_contest int not null default 5 check (basic_entries_per_contest between 1 and 1000),
  invites_per_contest       int not null default 10 check (invites_per_contest between 0 and 100),
  early_access_minutes      int not null default 60 check (early_access_minutes between 0 and 10080),
  f_early_access            boolean not null default true,
  f_highlighted_entries     boolean not null default true,
  f_client_chat             boolean not null default true,
  f_invitations             boolean not null default true,
  f_insights                boolean not null default true,
  f_priority_support        boolean not null default true,
  f_floating_card           boolean not null default true,
  f_show_contact_on_profile boolean not null default false,
  auto_remind               boolean not null default true,
  updated_at                timestamptz not null default now(),
  updated_by                uuid references public.profiles (id) on delete set null
);
insert into public.pro_settings (id) values (1) on conflict (id) do nothing;
alter table public.pro_settings enable row level security;
drop policy if exists pro_settings_read on public.pro_settings;
create policy pro_settings_read on public.pro_settings for select using (true);
drop policy if exists pro_settings_admin on public.pro_settings;
create policy pro_settings_admin on public.pro_settings for all using (public.admin_can('pro.manage')) with check (public.admin_can('pro.manage'));

-- 2. One subscription row per designer (renewals extend it; pro_payments keeps the history).
--    Pro = status is not 'expired' and current_period_end is in the future. 'cancelled' keeps Pro until the end date.
create table if not exists public.pro_subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  designer_id         uuid not null unique references public.profiles (id) on delete cascade,
  status              text not null default 'active' check (status in ('active', 'expiring', 'payment_failed', 'cancelled', 'expired')),
  price_bdt           int not null default 0 check (price_bdt >= 0),
  started_at          timestamptz not null default now(),
  first_started_at    timestamptz not null default now(),
  current_period_end  timestamptz not null,
  auto_renew          boolean not null default true,
  payment_method      text check (payment_method in ('bkash', 'card', 'free', 'trial')),
  cancel_reason       text check (cancel_reason is null or cancel_reason in ('too_expensive', 'not_enough_wins', 'one_contest', 'payment_problem', 'other')),
  cancel_note         text check (cancel_note is null or char_length(cancel_note) <= 300),
  cancelled_at        timestamptz,
  wins_at_start       int not null default 0,
  entries_at_start    int not null default 0,
  reminded_7d_at      timestamptz,
  reminded_1d_at      timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists pro_subscriptions_end_idx on public.pro_subscriptions (status, current_period_end);
alter table public.pro_subscriptions enable row level security;
drop policy if exists pro_subscriptions_own on public.pro_subscriptions;
create policy pro_subscriptions_own on public.pro_subscriptions for select using (designer_id = auth.uid() or public.admin_can('pro.view'));
drop policy if exists pro_subscriptions_admin on public.pro_subscriptions;
create policy pro_subscriptions_admin on public.pro_subscriptions for all using (public.admin_can('pro.manage')) with check (public.admin_can('pro.manage'));

-- 3. Every Pro payment (new, renewal), with its receipt number (PRO-000001).
create sequence if not exists public.pro_receipt_seq;
create table if not exists public.pro_payments (
  id               uuid primary key default gen_random_uuid(),
  subscription_id  uuid references public.pro_subscriptions (id) on delete set null,
  designer_id      uuid not null references public.profiles (id) on delete cascade,
  kind             text not null default 'new' check (kind in ('new', 'renewal')),
  amount_bdt       int not null check (amount_bdt >= 0),
  status           text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled')),
  method           text check (method in ('bkash', 'card')),
  provider         text not null,
  provider_ref     text,
  receipt_no       int unique default nextval('public.pro_receipt_seq'),
  promo_code       text,
  created_at       timestamptz not null default now(),
  paid_at          timestamptz,
  failed_at        timestamptz
);
create index if not exists pro_payments_designer_idx on public.pro_payments (designer_id, created_at desc);
alter table public.pro_payments enable row level security;
drop policy if exists pro_payments_own on public.pro_payments;
create policy pro_payments_own on public.pro_payments for select using (designer_id = auth.uid() or public.admin_can('pro.view'));
drop policy if exists pro_payments_admin on public.pro_payments;
create policy pro_payments_admin on public.pro_payments for all using (public.admin_can('pro.manage')) with check (public.admin_can('pro.manage'));

-- 4. The upgrade funnel. designer_id is null for visitors (visitor_id is the site's anonymous cookie).
create table if not exists public.pro_funnel_events (
  id           bigint generated always as identity primary key,
  designer_id  uuid references public.profiles (id) on delete set null,
  visitor_id   uuid,
  event        text not null check (event in ('card_seen', 'upgrade_clicked', 'checkout_opened', 'payment_started', 'paid', 'payment_failed', 'checkout_closed', 'renewed', 'cancelled', 'reminded')),
  step         text check (step is null or char_length(step) <= 40),
  created_at   timestamptz not null default now()
);
create index if not exists pro_funnel_events_idx on public.pro_funnel_events (event, created_at desc);
create index if not exists pro_funnel_events_designer_idx on public.pro_funnel_events (designer_id, created_at desc);
alter table public.pro_funnel_events enable row level security;
drop policy if exists pro_funnel_events_admin on public.pro_funnel_events;
create policy pro_funnel_events_admin on public.pro_funnel_events for select using (public.admin_can('pro.view'));

-- 5. Clients inviting Pro designers to a contest (free, at most invites_per_contest).
create table if not exists public.contest_invites (
  contest_id   uuid not null references public.contests (id) on delete cascade,
  designer_id  uuid not null references public.profiles (id) on delete cascade,
  invited_by   uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  notified_at  timestamptz,
  seen_at      timestamptz,
  joined_at    timestamptz,
  reminded_at  timestamptz,
  primary key (contest_id, designer_id)
);
create index if not exists contest_invites_designer_idx on public.contest_invites (designer_id, created_at desc);
alter table public.contest_invites enable row level security;
drop policy if exists contest_invites_read on public.contest_invites;
create policy contest_invites_read on public.contest_invites for select using (
  designer_id = auth.uid() or invited_by = auth.uid() or public.admin_can('pro.view')
);

-- At most invites_per_contest invitations per contest, also when two requests arrive together.
create or replace function public.contest_invites_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
begin
  perform 1 from public.contests where id = new.contest_id for update;
  select invites_per_contest into v_max from public.pro_settings where id = 1;
  if (select count(*) from public.contest_invites where contest_id = new.contest_id) >= coalesce(v_max, 10) then
    raise exception 'too_many_invites' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
drop trigger if exists contest_invites_limit on public.contest_invites;
create trigger contest_invites_limit before insert on public.contest_invites for each row execute function public.contest_invites_limit();

-- 6. A Pro designer's own portfolio uploads (not contest designs).
create table if not exists public.portfolio_items (
  id            uuid primary key default gen_random_uuid(),
  designer_id   uuid not null references public.profiles (id) on delete cascade,
  title         text not null default '' check (char_length(title) <= 80),
  image_path    text not null,
  preview_path  text not null,
  position      int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists portfolio_items_designer_idx on public.portfolio_items (designer_id, position, created_at desc);
alter table public.portfolio_items enable row level security;
drop policy if exists portfolio_items_read on public.portfolio_items;
create policy portfolio_items_read on public.portfolio_items for select using (designer_id = auth.uid() or public.admin_can('pro.view'));

-- 7. Logo checks a designer used per month (Basic 2, Pro 100 by default; starts again on the 1st).
create table if not exists public.logo_check_usage (
  designer_id  uuid not null references public.profiles (id) on delete cascade,
  month        date not null check (extract(day from month) = 1),
  used         int not null default 0 check (used >= 0),
  updated_at   timestamptz not null default now(),
  primary key (designer_id, month)
);
alter table public.logo_check_usage enable row level security;
drop policy if exists logo_check_usage_own on public.logo_check_usage;
create policy logo_check_usage_own on public.logo_check_usage for select using (designer_id = auth.uid() or public.admin_can('pro.view'));

-- 8. Quality score per designer, worked out every night (designer search order, invite ranking).
create table if not exists public.designer_quality_score (
  designer_id    uuid primary key references public.profiles (id) on delete cascade,
  score          int not null default 0 check (score between 0 and 100),
  rating         numeric(3, 2),
  win_rate       numeric(5, 2),
  wins           int not null default 0,
  entries        int not null default 0,
  contests       int not null default 0,
  reply_minutes  int,
  active_days    int not null default 0,
  computed_at    timestamptz not null default now()
);
alter table public.designer_quality_score enable row level security;
drop policy if exists designer_quality_score_read on public.designer_quality_score;
create policy designer_quality_score_read on public.designer_quality_score for select using (designer_id = auth.uid() or public.admin_can('pro.view'));

-- 9. Every change to the Pro plan, by an admin or the system (actor_id null).
create table if not exists public.pro_activity_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null check (char_length(action) <= 60),
  designer_id uuid references public.profiles (id) on delete set null,
  old_value   jsonb,
  new_value   jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists pro_activity_log_idx on public.pro_activity_log (created_at desc);
alter table public.pro_activity_log enable row level security;
drop policy if exists pro_activity_log_admin on public.pro_activity_log;
create policy pro_activity_log_admin on public.pro_activity_log for select using (public.admin_can('pro.view'));

-- 10. A designer's Pro choices (cover, featured work, privacy, alerts) and the Go Pro card being folded away.
create table if not exists public.pro_preferences (
  designer_id         uuid primary key references public.profiles (id) on delete cascade,
  title               text check (title is null or char_length(title) <= 60),
  show_badge          boolean not null default true,
  client_messages     boolean not null default true,
  weekly_report       boolean not null default false,
  show_contact        boolean not null default false,
  cover_entry_ids     uuid[] not null default '{}',
  featured_entry_ids  uuid[] not null default '{}',
  alert_services      text[] not null default '{}',   -- design types to alert about; empty = all
  alert_app           boolean not null default true,
  alert_email         boolean not null default true,
  similar_alerts      boolean not null default true,
  card_minimised      boolean not null default false,
  weekly_sent_at      timestamptz,
  updated_at          timestamptz not null default now()
);
alter table public.pro_preferences enable row level security;
drop policy if exists pro_preferences_own on public.pro_preferences;
create policy pro_preferences_own on public.pro_preferences for select using (designer_id = auth.uid() or public.admin_can('pro.view'));

-- 11. Contest chat: only the contest's client and the designer who sent that entry, only about that entry.
create table if not exists public.contest_messages (
  id          uuid primary key default gen_random_uuid(),
  contest_id  uuid not null references public.contests (id) on delete cascade,
  entry_id    uuid not null references public.entries (id) on delete cascade,
  client_id   uuid not null references public.profiles (id) on delete cascade,
  designer_id uuid not null references public.profiles (id) on delete cascade,
  sender_id   uuid not null references public.profiles (id) on delete cascade,
  body        text not null default '' check (char_length(body) <= 2000),
  file_path   text,
  file_name   text check (file_name is null or char_length(file_name) <= 120),
  file_size   int check (file_size is null or file_size >= 0),
  flags       text[] not null default '{}',
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  check (sender_id = client_id or sender_id = designer_id),
  check (char_length(body) > 0 or file_path is not null)
);
create index if not exists contest_messages_thread_idx on public.contest_messages (entry_id, created_at);
create index if not exists contest_messages_designer_idx on public.contest_messages (designer_id, created_at desc);
create index if not exists contest_messages_client_idx on public.contest_messages (client_id, created_at desc);
alter table public.contest_messages enable row level security;
drop policy if exists contest_messages_read on public.contest_messages;
create policy contest_messages_read on public.contest_messages for select using (
  (client_id = auth.uid() and exists (select 1 from public.contests c where c.id = contest_id and c.client_id = auth.uid()))
  or (designer_id = auth.uid() and exists (select 1 from public.entries e where e.id = entry_id and e.designer_id = auth.uid() and e.contest_id = contest_messages.contest_id))
  or public.admin_can('pro.view')
);
drop policy if exists contest_messages_write on public.contest_messages;
create policy contest_messages_write on public.contest_messages for insert with check (
  sender_id = auth.uid()
  and exists (select 1 from public.contests c where c.id = contest_id and c.client_id = contest_messages.client_id)
  and exists (select 1 from public.entries e where e.id = entry_id and e.contest_id = contest_messages.contest_id and e.designer_id = contest_messages.designer_id)
);

-- 12. Design views, for a Pro designer's insights (where they came from and when).
create table if not exists public.entry_views (
  id           bigint generated always as identity primary key,
  entry_id     uuid not null references public.entries (id) on delete cascade,
  designer_id  uuid not null references public.profiles (id) on delete cascade,
  viewer_id    uuid references public.profiles (id) on delete set null,
  by_client    boolean not null default false,
  source       text not null default 'contest' check (source in ('contest', 'browse', 'studio', 'leaderboard', 'profile', 'other')),
  created_at   timestamptz not null default now()
);
create index if not exists entry_views_designer_idx on public.entry_views (designer_id, created_at desc);
alter table public.entry_views enable row level security;
drop policy if exists entry_views_own on public.entry_views;
create policy entry_views_own on public.entry_views for select using (designer_id = auth.uid() or public.admin_can('pro.view'));

-- 13. Saved contests: a reminder before the end (Pro), sent once at 24 hours and once at 2 hours.
alter table public.contest_favorites add column if not exists remind boolean not null default true;
alter table public.contest_favorites add column if not exists reminded_24_at timestamptz;
alter table public.contest_favorites add column if not exists reminded_2_at timestamptz;

-- 13b. Private files for Pro: contest chat attachments (chat/<entry>/…) and portfolio uploads (portfolio/<designer>/…).
--      Only the server reads them and hands out short-lived links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pro-files', 'pro-files', false, 20971520, null)
on conflict (id) do nothing;

-- 14. Designers check their own logos (no contest): the check has no contest and source 'designer'.
alter table public.logo_checks alter column contest_id drop not null;
alter table public.logo_checks drop constraint if exists logo_checks_source_check;
alter table public.logo_checks add constraint logo_checks_source_check check (source in ('entry', 'upload', 'designer'));
alter table public.logo_checks drop constraint if exists logo_checks_designer_shape;
alter table public.logo_checks add constraint logo_checks_designer_shape check ((source = 'designer') = (contest_id is null));

-- Starts a designer's own check if they have checks left this month (p_from–p_to, Bangladesh time; failed checks
-- don't count). Safe against double clicks (same request key) and two requests at once (the usage row is locked).
create or replace function public.start_designer_logo_check(p_id uuid, p_request_key uuid, p_user_id uuid, p_image_path text, p_month date, p_from timestamptz, p_to timestamptz, p_limit int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid;
  v_used int;
begin
  select id into v_existing from public.logo_checks where request_key = p_request_key;
  if found then
    return jsonb_build_object('id', v_existing);
  end if;
  insert into public.logo_check_usage (designer_id, month, used) values (p_user_id, p_month, 0) on conflict do nothing;
  perform 1 from public.logo_check_usage where designer_id = p_user_id and month = p_month for update;
  select count(*) into v_used from public.logo_checks
   where requested_by = p_user_id and source = 'designer' and status <> 'failed'
     and created_at >= p_from and created_at < p_to;
  if v_used >= p_limit then
    raise exception 'limit' using errcode = 'check_violation';
  end if;
  insert into public.logo_checks (id, contest_id, entry_id, source, image_path, requested_by, request_key, paid, amount)
  values (p_id, null, null, 'designer', p_image_path, p_user_id, p_request_key, false, 0);
  update public.logo_check_usage set used = v_used + 1, updated_at = now() where designer_id = p_user_id and month = p_month;
  return jsonb_build_object('id', p_id);
end;
$$;
revoke all on function public.start_designer_logo_check(uuid, uuid, uuid, text, date, timestamptz, timestamptz, int) from public, anon, authenticated;

notify pgrst, 'reload schema';

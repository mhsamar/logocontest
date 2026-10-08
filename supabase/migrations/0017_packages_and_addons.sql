-- logocontest.bd — five packages, 3–30 day contests and more add-ons at launch
-- (owner, 2026-10-08; BLUEPRINT.md §7.1, §7.4, §8.1). Run after 0016 in Supabase → SQL Editor.
-- Safe to re-run, but re-running puts the prices and lengths below back to these values.

-- Packages: economy = Starter, standard = Growth, pro = Pro, premium = Premium, elite = Elite.
alter type public.contest_package add value if not exists 'pro' before 'premium';
alter type public.contest_package add value if not exists 'elite' after 'premium';

-- New add-ons chosen when the contest is created.
alter table public.contests add column if not exists is_highlighted boolean not null default false;
alter table public.contests add column if not exists is_urgent boolean not null default false;
alter table public.contests add column if not exists is_nda boolean not null default false;

-- NDA contests: designers who accepted the confidentiality agreement.
create table if not exists public.nda_acceptances (
  contest_id  uuid not null references public.contests (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  accepted_at timestamptz not null default now(),
  primary key (contest_id, user_id)
);
alter table public.nda_acceptances enable row level security;

-- Prices and lengths the owner set on 2026-10-08 (still editable in settings afterwards).
insert into public.settings (key, value, type, "group", description) values
  ('packages.premium_prize', '12000'::jsonb, 'int', 'packages', 'Premium package prize (taka).'),
  ('packages.pro_prize', '8000'::jsonb, 'int', 'packages', 'Pro package prize (taka).'),
  ('packages.elite_prize', '15000'::jsonb, 'int', 'packages', 'Elite package prize (taka).'),
  ('timers.contest_duration_options_days', '[3, 5, 7, 10, 14, 21, 30]'::jsonb, 'json', 'timers', 'Quick-pick contest lengths shown as chips (days).'),
  ('timers.contest_duration_min_days', '3'::jsonb, 'int', 'timers', 'Shortest contest the client can choose (days).'),
  ('timers.contest_duration_max_days', '30'::jsonb, 'int', 'timers', 'Longest contest the client can choose (days).'),
  ('upgrades.highlight_price', '500'::jsonb, 'int', 'upgrades', 'Highlight add-on: gold border and badge in lists (taka).'),
  ('upgrades.urgent_price', '500'::jsonb, 'int', 'upgrades', 'Urgent add-on: "Urgent" badge (taka).'),
  ('upgrades.nda_price', '1500'::jsonb, 'int', 'upgrades', 'NDA add-on: designers accept a confidentiality agreement; includes Private (taka).')
on conflict (key) do update set value = excluded.value, description = excluded.description;

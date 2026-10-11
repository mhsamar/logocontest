-- logocontest.bd - monthly rewards (smartphone for the top client, mystery gift box for the top designer), contest
-- win cards and test accounts (owner, 2026-10-11; Design/rewards/REWARDS-HANDOFF.md, BLUEPRINT §11). Run after 0034.
-- Safe to re-run. Nothing is dropped: the old Monthly Winner tables (monthly_winners, design_likes) stay, unused.
--
-- Privacy: only the server (service role) reads and writes these tables. Row level security is on with no
-- policies, so no browser can read them directly. A winner's claim goes through claim_monthly_reward(), which
-- accepts it only from the winner and only once; claim details are shown only in Admin → Monthly winner.

-- 1. Test accounts (Admin → Users): never counted in the monthly race --------------------------------------
alter table public.profiles add column if not exists is_test boolean not null default false;

-- 2. Closed months ------------------------------------------------------------------------------------------
-- One row per closed month, so closing twice never makes two rewards. `is_test` marks a test-mode close
-- (only test accounts counted, nothing sent to real users).
create table if not exists public.reward_months (
  month        text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  is_test      boolean not null default false,
  -- waiting_approval: "Ask me first" was on; sent: cards and messages went out; no_winner: nobody qualified.
  status       text not null check (status in ('waiting_approval', 'sent', 'no_winner')),
  closed_at    timestamptz not null default now(),
  closed_by    uuid references public.profiles (id) on delete set null,   -- null = the scheduled job
  approved_at  timestamptz,
  approved_by  uuid references public.profiles (id) on delete set null,
  primary key (month, is_test)
);
alter table public.reward_months enable row level security;

-- 3. Monthly rewards: one per month and kind ------------------------------------------------------------------
create sequence if not exists public.monthly_reward_number_seq;

create table if not exists public.monthly_rewards (
  id               uuid primary key default gen_random_uuid(),
  -- Shown as RW-0001.
  number           int not null unique default nextval('public.monthly_reward_number_seq'),
  month            text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  kind             text not null check (kind in ('smartphone', 'gift_box')),
  is_test          boolean not null default false,
  winner_id        uuid not null references public.profiles (id) on delete cascade,
  -- The winner's numbers when the month closed, frozen: { contests, prize_total, spent } for a client,
  -- { wins, joined, earned } for a designer.
  stats            jsonb not null default '{}'::jsonb,
  card_square_path text,
  card_story_path  text,
  -- When the card and messages went to the winner (null while waiting for an admin's approval).
  sent_at          timestamptz,
  status           text not null default 'not_claimed' check (status in ('not_claimed', 'claimed', 'contacted', 'delivered')),
  claim_name       text check (claim_name is null or char_length(claim_name) between 2 and 80),
  claim_mobile     text check (claim_mobile is null or claim_mobile ~ '^01[3-9][0-9]{8}$'),
  claim_address    text check (claim_address is null or char_length(claim_address) between 10 and 400),
  claimed_at       timestamptz,
  contacted_at     timestamptz,
  delivered_at     timestamptz,
  admin_note       text check (admin_note is null or char_length(admin_note) <= 1000),
  reminded_at      timestamptz,
  reminder_count   int not null default 0,
  created_at       timestamptz not null default now(),
  unique (month, kind, is_test)
);
create index if not exists monthly_rewards_winner_idx on public.monthly_rewards (winner_id);
create index if not exists monthly_rewards_status_idx on public.monthly_rewards (status) where is_test = false;
alter table public.monthly_rewards enable row level security;

-- The winner claims once: name, Bangladesh mobile (11 digits starting with 01), address.
create or replace function public.claim_monthly_reward(p_reward_id uuid, p_user_id uuid, p_name text, p_mobile text, p_address text)
returns public.monthly_rewards
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.monthly_rewards;
begin
  select * into v from public.monthly_rewards where id = p_reward_id for update;
  if not found or v.winner_id <> p_user_id then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v.sent_at is null then
    raise exception 'not_sent' using errcode = 'P0001';
  end if;
  if v.status <> 'not_claimed' then
    raise exception 'already' using errcode = 'P0001';
  end if;
  update public.monthly_rewards
     set status = 'claimed',
         claim_name = trim(p_name),
         claim_mobile = p_mobile,
         claim_address = trim(p_address),
         claimed_at = now()
   where id = p_reward_id
  returning * into v;
  return v;
end;
$$;
revoke execute on function public.claim_monthly_reward(uuid, uuid, text, text, text) from public, anon, authenticated;

-- 4. Contest win cards: one per contest winner -------------------------------------------------------------
create table if not exists public.win_cards (
  id           uuid primary key default gen_random_uuid(),
  contest_id   uuid not null unique references public.contests (id) on delete cascade,
  entry_id     uuid not null references public.entries (id) on delete cascade,
  designer_id  uuid not null references public.profiles (id) on delete cascade,
  -- The public page /wins/<slug>.
  slug         text not null unique check (slug ~ '^[a-z0-9-]{6,80}$'),
  -- Blind, private and NDA contests: the card shows the logo blurred with a "Blind contest" label (owner, 2026-10-11).
  hidden_logo  boolean not null default false,
  square_path  text,
  story_path   text,
  created_at   timestamptz not null default now()
);
create index if not exists win_cards_designer_idx on public.win_cards (designer_id, created_at desc);
alter table public.win_cards enable row level security;

-- 5. Card pictures: public, because they are made to be shared --------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reward-cards', 'reward-cards', true, 5242880, array['image/png', 'image/jpeg'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 6. Settings (Admin → Monthly winner and Admin → Home hero) ---------------------------------------------------
insert into public.settings (key, value, type, "group", description) values
  ('rewards.win_card_on', 'true'::jsonb, 'bool', 'rewards', 'Send the contest win card to the designer right after a winner is picked.'),
  ('rewards.smartphone_card_on', 'true'::jsonb, 'bool', 'rewards', 'Send the smartphone card to the top client when the month closes.'),
  ('rewards.gift_box_card_on', 'true'::jsonb, 'bool', 'rewards', 'Send the gift box card to the top designer when the month closes.'),
  ('rewards.ask_first', 'false'::jsonb, 'bool', 'rewards', 'Hold the monthly cards until an admin approves them.'),
  ('rewards.claim_deadline', '""'::jsonb, 'string', 'rewards', 'Last day to claim a monthly prize (YYYY-MM-DD). Empty shows no deadline.'),
  ('home.hero_offer_slide', 'true'::jsonb, 'bool', 'home', 'Show the monthly prizes slide (slide 5) after the home hero slides.')
on conflict (key) do nothing;

notify pgrst, 'reload schema';

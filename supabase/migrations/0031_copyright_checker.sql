-- logocontest.bd — AI copyright checker (owner, 2026-10-10; BLUEPRINT §7.7, Design/copyright-checker).
-- Run after 0030 in Supabase → SQL Editor. Safe to re-run.
-- The checker replaces the Logo Scan add-on: it keeps the add-on key `logo_scan`, the contests.logo_scan
-- flag and the upgrades.logo_scan_price setting, so contests that bought Logo Scan get the checker.
-- Only the server (service role) writes. The contest's client and admins with the "copyright.view"
-- permission can read a check (row level security). Files are in a private bucket that only the server
-- reads; it hands out short signed links after the same check.

-- 1. Settings ------------------------------------------------------------------------------------
update public.settings
   set description = 'Price of the AI copyright checker add-on (3 logo checks) for contests under the free prize (taka; owner, 2026-10-10).'
 where key = 'upgrades.logo_scan_price';

insert into public.settings (key, value, type, "group", description) values
  ('upgrades.logo_check_free_from', '8000'::jsonb, 'int', 'upgrades', 'Contests with this prize (taka) or more get the AI copyright checker free.'),
  ('limits.logo_checks_per_contest', '3'::jsonb, 'int', 'limits', 'AI logo checks per contest (free or paid). Failed checks do not count.'),
  ('limits.logo_check_close_from', '45'::jsonb, 'int', 'limits', 'AI copyright checker: a found logo this similar (0-100) or more counts as a close match.'),
  ('limits.logo_check_high_risk_from', '85'::jsonb, 'int', 'limits', 'AI copyright checker: a found logo this similar (0-100) or more makes the result High risk.')
on conflict (key) do nothing;

-- 2. Checks -------------------------------------------------------------------------------------
create sequence if not exists public.logo_check_number_seq;

create table if not exists public.logo_checks (
  id                    uuid primary key default gen_random_uuid(),
  number                int not null unique default nextval('public.logo_check_number_seq'),   -- shown as CC-0001
  contest_id            uuid not null references public.contests (id) on delete cascade,
  entry_id              uuid references public.entries (id) on delete set null,              -- null for an uploaded image
  source                text not null check (source in ('entry', 'upload')),
  image_path            text not null,                                                         -- the logo as checked, in logo-checks
  requested_by          uuid not null references public.profiles (id) on delete cascade,
  request_key           uuid not null unique,                                                  -- sent by the browser: a double click sends the same key
  status                text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  step                  smallint not null default 0 check (step between 0 and 6),             -- the step running now (1-6)
  attempts              smallint not null default 0,
  locked_until          timestamptz,                                                           -- the runner holding the job
  paid                  boolean not null,                                                      -- false = free (prize at or over the free limit)
  amount                int not null default 0 check (amount >= 0),                            -- add-on price (taka) when paid
  verdict               text check (verdict in ('no_match', 'similar', 'high_risk')),
  reading               jsonb,                                                                 -- what the AI read: shape, type, text, colours, font
  scores                jsonb,                                                                 -- uniqueness, legibility, colour, overall: score + sentence
  advice                text,
  sources               jsonb,                                                                 -- each search: ran or not, how many found
  certificate_pdf_path  text,
  certificate_png_path  text,
  error                 text,
  cost_usd              numeric(10, 4) not null default 0,                                     -- what the AI and search calls cost
  created_at            timestamptz not null default now(),
  started_at            timestamptz,
  finished_at           timestamptz,
  updated_at            timestamptz not null default now()
);
create index if not exists logo_checks_contest_idx on public.logo_checks (contest_id, created_at desc);
create index if not exists logo_checks_requested_idx on public.logo_checks (requested_by, created_at desc);
create index if not exists logo_checks_created_idx on public.logo_checks (created_at desc);
-- A design is checked once (a failed check can be tried again).
create unique index if not exists logo_checks_entry_once on public.logo_checks (entry_id) where entry_id is not null and status <> 'failed';
alter table public.logo_checks enable row level security;

drop trigger if exists logo_checks_touch on public.logo_checks;
create trigger logo_checks_touch before update on public.logo_checks
  for each row execute function public.touch_updated_at();

-- The similar logos found by a check (at most 8 kept).
create table if not exists public.logo_check_matches (
  id          uuid primary key default gen_random_uuid(),
  check_id    uuid not null references public.logo_checks (id) on delete cascade,
  position    smallint not null check (position between 0 and 7),
  found_by    text not null check (found_by in ('lens', 'vision', 'site')),
  image_path  text,                                                   -- our copy, in logo-checks
  image_url   text check (image_url is null or char_length(image_url) <= 2000),
  page_url    text check (page_url is null or char_length(page_url) <= 2000),
  title       text check (title is null or char_length(title) <= 300),
  site        text check (site is null or char_length(site) <= 200),
  entry_id    uuid references public.entries (id) on delete set null,  -- found on logocontest.bd
  similarity  smallint not null check (similarity between 0 and 100),
  same        text[] not null default '{}',
  different   text[] not null default '{}',
  is_close    boolean not null default false,
  unique (check_id, position)
);
alter table public.logo_check_matches enable row level security;

-- 3. Who can read a check --------------------------------------------------------------------------
create or replace function public.can_read_logo_check(p_contest_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.contests c where c.id = p_contest_id and c.client_id = auth.uid())
      or exists (
        select 1 from public.profiles p
         where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
           and (p.is_super_admin or (p.admin_active and p.admin_permissions && array['copyright.view']))
      );
$$;

drop policy if exists logo_checks_read on public.logo_checks;
create policy logo_checks_read on public.logo_checks
  for select using (public.can_read_logo_check(contest_id));

drop policy if exists logo_check_matches_read on public.logo_check_matches;
create policy logo_check_matches_read on public.logo_check_matches
  for select using (exists (select 1 from public.logo_checks k where k.id = check_id and public.can_read_logo_check(k.contest_id)));

-- 4. Private files: checked logos, copies of found images, certificates ------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logo-checks', 'logo-checks', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 5. Start a check: every rule in one locked step ---------------------------------------------------
-- Returns the existing check when the same request key arrives twice (double click).
create or replace function public.start_logo_check(
  p_id uuid, p_request_key uuid, p_contest_id uuid, p_user_id uuid, p_entry_id uuid, p_source text, p_image_path text
)
returns public.logo_checks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contest   public.contests;
  v_check     public.logo_checks;
  v_limit     int;
  v_free_from int;
  v_price     int;
  v_used      int;
  v_free      boolean;
begin
  select * into v_contest from public.contests where id = p_contest_id for update;
  if not found or v_contest.client_id <> p_user_id then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select * into v_check from public.logo_checks where request_key = p_request_key;
  if found then
    return v_check;
  end if;

  if v_contest.status not in ('open', 'judging') then
    raise exception 'closed' using errcode = 'P0001';
  end if;

  v_limit     := coalesce((select (value #>> '{}')::int from public.settings where key = 'limits.logo_checks_per_contest'), 3);
  v_free_from := coalesce((select (value #>> '{}')::int from public.settings where key = 'upgrades.logo_check_free_from'), 8000);
  v_price     := coalesce((select (value #>> '{}')::int from public.settings where key = 'upgrades.logo_scan_price'), 500);
  v_free      := v_contest.prize_amount >= v_free_from;

  if not v_free and not v_contest.logo_scan then
    raise exception 'locked' using errcode = 'P0001';
  end if;

  select count(*) into v_used from public.logo_checks where contest_id = p_contest_id and status <> 'failed';
  if v_used >= v_limit then
    raise exception 'limit' using errcode = 'P0001';
  end if;

  if p_source = 'entry' then
    if p_entry_id is null or not exists (select 1 from public.entries where id = p_entry_id and contest_id = p_contest_id) then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    if exists (select 1 from public.logo_checks where entry_id = p_entry_id and status <> 'failed') then
      raise exception 'checked' using errcode = 'P0001';
    end if;
  elsif p_source <> 'upload' or p_entry_id is not null then
    raise exception 'invalid' using errcode = 'P0001';
  end if;

  insert into public.logo_checks (id, contest_id, entry_id, source, image_path, requested_by, request_key, paid, amount)
  values (p_id, p_contest_id, p_entry_id, p_source, p_image_path, p_user_id, p_request_key, not v_free, case when v_free then 0 else v_price end)
  returning * into v_check;
  return v_check;
end;
$$;

-- 6. The background runner takes a check for a while (so two runners never work on the same one) ---
-- Returns null when the check is finished or another runner holds it.
create or replace function public.claim_logo_check(p_id uuid, p_lease_seconds int default 120)
returns public.logo_checks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_check public.logo_checks;
begin
  update public.logo_checks
     set status = 'running',
         attempts = attempts + 1,
         locked_until = now() + make_interval(secs => greatest(30, least(p_lease_seconds, 600))),
         started_at = coalesce(started_at, now())
   where id = p_id
     and status in ('queued', 'running')
     and (locked_until is null or locked_until < now())
  returning * into v_check;
  return v_check;
end;
$$;

-- 7. Designs from other contests that look closest (image fingerprint, 64-bit difference hash).
-- Never private contests, never blind contests that are still running, never withdrawn or removed designs.
create or replace function public.logo_check_similar_entries(p_hash text, p_contest_id uuid, p_limit int default 6)
returns table (entry_id uuid, contest_id uuid, preview_path text, distance int)
language sql
stable
security definer
set search_path = public
as $$
  select t.entry_id, t.contest_id, t.preview_path, t.distance
    from (
      select distinct on (ei.entry_id)
             ei.entry_id, e.contest_id, ei.preview_path,
             bit_count(('x' || ei.phash)::bit(64) # ('x' || p_hash)::bit(64))::int as distance
        from public.entry_images ei
        join public.entries e on e.id = ei.entry_id
        join public.contests c on c.id = e.contest_id
       where ei.phash ~ '^[0-9a-f]{16}$'
         and p_hash ~ '^[0-9a-f]{16}$'
         and e.contest_id <> p_contest_id
         and e.status not in ('withdrawn', 'removed')
         and not c.is_private
         and not (c.is_blind and c.status in ('open', 'judging'))
         and c.status not in ('draft', 'pending_payment', 'cancelled')
       order by ei.entry_id, distance
    ) t
   order by t.distance
   limit greatest(1, least(p_limit, 20));
$$;

-- 8. The checker add-on can also be bought while the client is judging ------------------------------
-- Same as 0014, except for the contest status check.
create or replace function public.confirm_addon_payment(p_payment_id uuid, p_amount int, p_gateway_txn_id text, p_raw jsonb)
returns public.contests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_contest public.contests;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'payment % not found', p_payment_id using errcode = 'no_data_found';
  end if;
  select * into v_contest from public.contests where id = v_payment.contest_id for update;

  if v_payment.status = 'paid' then
    return v_contest; -- duplicate callback
  end if;
  if v_payment.purpose::text not in ('addon', 'extension') then
    raise exception 'payment % is not an add-on payment', p_payment_id;
  end if;
  if p_amount <> v_payment.amount then
    raise exception 'amount mismatch for payment %', p_payment_id using errcode = 'check_violation';
  end if;
  if v_contest.status <> 'open' and not (v_payment.addon = 'logo_scan' and v_contest.status = 'judging') then
    raise exception 'contest % is not open', v_contest.id;
  end if;

  update public.payments
     set status = 'paid', paid_at = now(), gateway_txn_id = p_gateway_txn_id, raw_response = p_raw
   where id = p_payment_id;

  if v_payment.purpose::text = 'extension' then
    update public.contests
       set ends_at = ends_at + make_interval(days => v_payment.extension_days),
           extensions_count = extensions_count + 1,
           extension_days_total = extension_days_total + v_payment.extension_days
     where id = v_contest.id returning * into v_contest;
  elsif v_payment.addon = 'promote' then
    update public.contests set is_promoted = true where id = v_contest.id returning * into v_contest;
  elsif v_payment.addon = 'private' then
    update public.contests set is_private = true where id = v_contest.id returning * into v_contest;
  elsif v_payment.addon = 'blind' then
    update public.contests set is_blind = true where id = v_contest.id returning * into v_contest;
  elsif v_payment.addon = 'logo_scan' then
    update public.contests set logo_scan = true where id = v_contest.id returning * into v_contest;
  end if;

  return v_contest;
end;
$$;

-- Only the server calls these.
revoke execute on function public.start_logo_check(uuid, uuid, uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.claim_logo_check(uuid, int) from public, anon, authenticated;
revoke execute on function public.logo_check_similar_entries(text, uuid, int) from public, anon, authenticated;

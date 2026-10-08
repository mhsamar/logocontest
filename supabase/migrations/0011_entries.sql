-- logocontest.bd — designs (entries), their mockups and comments (owner, 2026-10-08; BLUEPRINT.md §5, §9.2, §10).
-- Run after 0010 in Supabase → SQL Editor. Safe to re-run.

do $$ begin
  create type public.entry_status as enum ('active', 'rejected', 'withdrawn', 'removed', 'winner', 'forfeited');
exception when duplicate_object then null; end $$;

-- One design submitted to a contest. A designer may submit any number.
create table if not exists public.entries (
  id               uuid primary key default gen_random_uuid(),
  contest_id       uuid not null references public.contests (id) on delete cascade,
  designer_id      uuid not null references public.profiles (id) on delete cascade,
  number           int not null,
  status           public.entry_status not null default 'active',
  logo_story       text check (logo_story is null or char_length(logo_story) <= 600),
  rating           smallint check (rating between 1 and 5),
  is_shortlisted   boolean not null default false,
  reject_reason    text,
  reject_note      text,
  rejected_at      timestamptz,
  declarations     jsonb not null,
  declared_ip      text,
  declared_at      timestamptz not null,
  created_at       timestamptz not null default now(),
  unique (contest_id, number)
);

create index if not exists entries_contest_idx on public.entries (contest_id, number);
create index if not exists entries_designer_idx on public.entries (designer_id, created_at desc);

-- Per-contest entry numbers (#1, #2, …), safe when two designers submit at once.
create or replace function public.set_entry_number() returns trigger
language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.contest_id::text));
  select coalesce(max(number), 0) + 1 into new.number from public.entries where contest_id = new.contest_id;
  return new;
end $$;

drop trigger if exists entries_set_number on public.entries;
create trigger entries_set_number before insert on public.entries
  for each row execute function public.set_entry_number();

-- The 1–8 mockups of a design, all 1000×1000. Position 0 is the cover.
create table if not exists public.entry_images (
  id                     uuid primary key default gen_random_uuid(),
  entry_id               uuid not null references public.entries (id) on delete cascade,
  position               smallint not null check (position between 0 and 7),
  original_path          text not null unique,
  preview_path           text not null unique,
  phash                  text,
  duplicate_of_entry_id  uuid references public.entries (id) on delete set null,
  created_at             timestamptz not null default now(),
  unique (entry_id, position)
);

create index if not exists entry_images_entry_idx on public.entry_images (entry_id, position);

-- The comment box on each design.
create table if not exists public.entry_comments (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.entries (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  is_hidden   boolean not null default false,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists entry_comments_entry_idx on public.entry_comments (entry_id, created_at);

-- Server-only tables: RLS on, no policies.
alter table public.entries        enable row level security;
alter table public.entry_images   enable row level security;
alter table public.entry_comments enable row level security;

-- Private bucket: originals and watermarked previews. Pages get short-lived signed links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('entry-files', 'entry-files', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Owner, 2026-10-08: 1 to 8 mockups per design, stored at 1000×1000.
update public.settings set value = '1'::jsonb,
  description = 'Minimum mockups per design.' where key = 'limits.entry_min_images';
update public.settings set value = '8'::jsonb,
  description = 'Maximum mockups per design. A designer who wants more submits another design.' where key = 'limits.entry_max_images';
update public.settings set value = '1000'::jsonb,
  description = 'Every design mockup is stored as this many pixels square; smaller images are refused, others are cropped to it.' where key = 'limits.entry_image_min_px';
update public.settings set value = '1000'::jsonb,
  description = 'Long side of the watermarked preview (px).' where key = 'limits.entry_preview_max_px';

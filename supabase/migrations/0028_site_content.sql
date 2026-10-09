-- logocontest.bd — site content editable in the admin panel (owner, 2026-10-09; BLUEPRINT §13.1, milestone 12).
-- Run after 0027 in Supabase → SQL Editor. Safe to re-run.
--
-- Only the server (service role) reads and writes these tables: row level security is on
-- and there are no policies, so the anon and signed-in roles see nothing.

-- 1. Texts: an admin's version of any built-in text. No row = the built-in text is used.
create table if not exists public.site_texts (
  key        text not null check (char_length(key) between 1 and 200),
  locale     text not null check (locale in ('en', 'bn')),
  value      text not null check (char_length(value) <= 20000),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (key, locale)
);
alter table public.site_texts enable row level security;

-- 2. Lists (home FAQ, How-it-works steps, menu and footer links, business types, colours).
-- No row = the built-in list is used. items = [{ id, on, en: {...}, bn: {...}, ...extra }].
create table if not exists public.site_lists (
  key        text primary key check (char_length(key) between 1 and 60),
  items      jsonb not null check (jsonb_typeof(items) = 'array'),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.site_lists enable row level security;

-- 3. Legal pages and the designer agreement, as published by an admin. No row = the built-in text.
-- version is the "Last updated" date. require_resign (agreement only): designers who signed an
-- older version sign again before their next design.
create table if not exists public.legal_docs (
  slug           text not null check (slug in ('terms', 'privacy', 'payment-refund', 'designer-rules', 'agreement')),
  locale         text not null check (locale in ('en', 'bn')),
  body           text not null check (char_length(body) <= 100000),
  version        text not null check (version ~ '^\d{4}-\d{2}-\d{2}$'),
  require_resign boolean not null default false,
  published_by   uuid references public.profiles(id) on delete set null,
  published_at   timestamptz not null default now(),
  primary key (slug, locale)
);
alter table public.legal_docs enable row level security;

-- 4. Pictures: site logo, app icon, hero picture, share picture. Public, 2 MB, images only.
-- Uploads go through one-time signed URLs made by the server for admins.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site', 'site', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';

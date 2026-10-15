-- 0060 Guides (owner, 2026-10-15): articles for clients and designers, written in Admin › Guides, shown on /guides,
-- in the footer (the ones chosen) and in the sitemap. Only the server (service role) reads and writes them.
create table if not exists public.guides (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  category      text not null default 'everyone' check (category in ('clients', 'designers', 'everyone')),
  title_en      text not null default '' check (char_length(title_en) <= 140),
  title_bn      text not null default '' check (char_length(title_bn) <= 140),
  summary_en    text not null default '' check (char_length(summary_en) <= 300),
  summary_bn    text not null default '' check (char_length(summary_bn) <= 300),
  body_en       text not null default '' check (char_length(body_en) <= 60000),
  body_bn       text not null default '' check (char_length(body_bn) <= 60000),
  cover_path    text check (cover_path is null or cover_path ~ '^guides/[0-9a-f-]{36}\.(png|jpg|webp)$'),
  status        text not null default 'draft' check (status in ('draft', 'published')),
  in_footer     boolean not null default false,
  -- The Bangla version is complete (title, summary, enough words); until then Bangla readers see the English one.
  bn_ready      boolean not null default false,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id) on delete set null,
  updated_by    uuid references public.profiles (id) on delete set null
);
create index if not exists guides_published_idx on public.guides (status, published_at desc);
alter table public.guides enable row level security;

notify pgrst, 'reload schema';

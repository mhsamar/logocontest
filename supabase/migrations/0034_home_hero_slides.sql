-- logocontest.bd - Admin → Home hero: the home page's showcase slides, edited by admins (owner, 2026-10-11;
-- Design/home-hero/HERO-HANDOFF.md, UI-JOURNEY P-01 and A-09b). Run after 0033. Safe to re-run. Nothing is dropped.
--
-- While no slide is switched on, the home page shows the built-in sample slides (src/lib/home/hero-slides.ts).
-- Only the server (service role) reads and writes the table: row level security with no policies.
-- Pictures go in the public "site" bucket under hero-slides/ (the server re-saves them: photos as JPEG without
-- hidden data, logos as PNG); the built-in sample pictures are paths starting with /home-hero/.

create table if not exists public.home_hero_slides (
  id                uuid primary key default gen_random_uuid(),
  position          int not null default 0,
  is_active         boolean not null default true,
  brand             text not null check (char_length(brand) between 1 and 40),
  person_name       text not null check (char_length(person_name) between 1 and 40),
  role              text not null check (role in ('designer', 'client')),
  item              text not null check (item in ('cup', 'ticket', 'bag', 'phone')),
  color_main        text not null check (color_main ~ '^#[0-9A-Fa-f]{6}$'),
  color_dark        text not null check (color_dark ~ '^#[0-9A-Fa-f]{6}$'),
  color_light       text not null check (color_light ~ '^#[0-9A-Fa-f]{6}$'),
  color_badge       text not null check (color_badge ~ '^#[0-9A-Fa-f]{6}$'),
  -- Pictures: the stored path and the picture's size in pixels.
  photo_path        text not null check (photo_path ~ '^(/home-hero/|hero-slides/)'),
  photo_w           int not null check (photo_w > 0),
  photo_h           int not null check (photo_h > 0),
  -- Which part of the photo stays in view: "50% 25%" keeps the top quarter (faces).
  photo_focus       int not null default 25 check (photo_focus between 0 and 100),
  logo_path         text not null check (logo_path ~ '^(/home-hero/|hero-slides/)'),
  logo_w            int not null check (logo_w > 0),
  logo_h            int not null check (logo_h > 0),
  logo_white_path   text not null check (logo_white_path ~ '^(/home-hero/|hero-slides/)'),
  logo_white_w      int not null check (logo_white_w > 0),
  logo_white_h      int not null check (logo_white_h > 0),
  -- The round badge shows the white logo when its background is dark or the brand colour.
  badge_logo        text not null default 'color' check (badge_logo in ('color', 'white')),
  -- Headline (two lines) and one line of text; Bangla falls back to English when left empty.
  line1_en          text not null check (char_length(line1_en) between 1 and 40),
  line2_en          text not null check (char_length(line2_en) between 1 and 40),
  text_en           text not null check (char_length(text_en) between 1 and 200),
  line1_bn          text check (line1_bn is null or char_length(line1_bn) <= 40),
  line2_bn          text check (line2_bn is null or char_length(line2_bn) <= 40),
  text_bn           text check (text_bn is null or char_length(text_bn) <= 200),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  updated_by        uuid references public.profiles (id) on delete set null
);
create index if not exists home_hero_slides_order_idx on public.home_hero_slides (position, created_at);
alter table public.home_hero_slides enable row level security;

-- Two settings for the hero (Admin → Home hero).
insert into public.settings (key, value, type, "group", description) values
  ('home.hero_slide_seconds', '2'::jsonb, 'int', 'home', 'How many seconds each home hero slide shows.'),
  ('home.hero_sample_pill', 'true'::jsonb, 'bool', 'home', 'Show the "Sample artwork" pill under the home hero slides. Turn it off once the slides are real contest winners.')
on conflict (key) do nothing;

notify pgrst, 'reload schema';

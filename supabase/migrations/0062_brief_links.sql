-- 0062 Wizard in 8 steps (owner, 2026-10-15): "Other" business type, website & social links, competitors, and the
-- new requirement tick-boxes. Run in two blocks.

-- Block 1
alter table public.contests add column if not exists business_type_other text;
alter table public.contests add column if not exists links jsonb not null default '[]'::jsonb;
alter table public.contests add column if not exists competitors text;
alter table public.contests drop constraint if exists contests_business_type_other_len;
alter table public.contests add constraint contests_business_type_other_len check (business_type_other is null or char_length(business_type_other) <= 60);
alter table public.contests drop constraint if exists contests_competitors_len;
alter table public.contests add constraint contests_competitors_len check (competitors is null or char_length(competitors) <= 300);

-- Block 2
alter table public.contests drop constraint if exists contests_requirements_check;
alter table public.contests add constraint contests_requirements_check
  check (requirements <@ array['trust', 'simple', 'no_effects', 'strong_idea', 'readable_small', 'one_colour', 'no_stock', 'home_mockup']::text[]);
notify pgrst, 'reload schema';

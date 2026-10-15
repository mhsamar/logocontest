-- Undo 0062. Contests that use the new requirement values keep them only if the old check is not put back.
alter table public.contests drop constraint if exists contests_competitors_len;
alter table public.contests drop constraint if exists contests_business_type_other_len;
alter table public.contests drop column if exists competitors;
alter table public.contests drop column if exists links;
alter table public.contests drop column if exists business_type_other;
alter table public.contests drop constraint if exists contests_requirements_check;
update public.contests set requirements = array(select unnest(requirements) intersect select unnest(array['no_stock', 'home_mockup']::text[]));
alter table public.contests add constraint contests_requirements_check check (requirements <@ array['no_stock', 'home_mockup']::text[]);
notify pgrst, 'reload schema';

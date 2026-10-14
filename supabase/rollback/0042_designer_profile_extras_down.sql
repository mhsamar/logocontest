-- Undo 0042: removes the designer profile extras (languages, a level per skill, years per tool) and what was saved in them.
alter table public.profiles drop column if exists languages;
alter table public.profiles drop column if exists skill_levels;
alter table public.profiles drop column if exists tool_years;

notify pgrst, 'reload schema';

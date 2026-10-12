-- Designer profile redesign (owner, 2026-10-12; Design/designer-profile): optional extras the designer sets on
-- Edit profile. Languages they speak, a level per skill (learning, good, strong, expert) and years per tool.
-- All optional; the profile hides each box when it is empty. Safe to re-run. Nothing is dropped.
alter table public.profiles add column if not exists languages text[] not null default '{}';
alter table public.profiles add column if not exists skill_levels jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists tool_years jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';

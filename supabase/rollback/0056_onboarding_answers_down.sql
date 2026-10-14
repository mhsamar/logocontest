-- Undo 0056: removes the answers to the owner's own onboarding questions.
alter table public.contests drop column if exists extra_answers;
alter table public.profiles drop column if exists onboarding_answers;
delete from public.settings where key in ('onboarding.client', 'onboarding.designer');

notify pgrst, 'reload schema';

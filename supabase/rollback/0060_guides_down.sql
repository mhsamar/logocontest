-- Undo 0060: removes the guides (their pictures stay in the site bucket under guides/).
drop table if exists public.guides;

notify pgrst, 'reload schema';

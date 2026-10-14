-- Undo 0052_wizard_leads.sql: removes the saved wizard mobile numbers.
drop table if exists public.wizard_leads;
notify pgrst, 'reload schema';

-- Undo 0048_pro_trial.sql (owner, 2026-10-14). Run only after the app is rolled back. Removes every trial and its
-- history (designers who were on a trial are Basic again; their portfolio images stay in portfolio_items).
drop table if exists public.pro_trial_events;
drop table if exists public.pro_trials;
alter table public.pro_settings drop constraint if exists pro_settings_free_trial_ranges;
alter table public.pro_settings drop column if exists trial_portfolio_limit;
alter table public.pro_settings drop column if exists trial_logo_checks;
alter table public.pro_settings drop column if exists free_trial_days;
alter table public.pro_settings drop column if exists free_trial_enabled;
notify pgrst, 'reload schema';

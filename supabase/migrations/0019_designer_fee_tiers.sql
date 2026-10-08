-- logocontest.bd — new designer fee tiers (owner, 2026-10-08; BLUEPRINT.md §2, §7.2):
-- 15% to start, 10% after 10 counted wins, 5% after 50. Run after 0018 in Supabase → SQL Editor.
-- Safe to re-run, but re-running puts the tiers back to these values.
-- The rate is still fixed per win when the winner is picked, so wins already picked keep their rate.

insert into public.settings (key, value, type, "group", description) values
  ('fees.designer_tiers',
   '[{"min_wins": 0, "rate_percent": 15}, {"min_wins": 10, "rate_percent": 10}, {"min_wins": 50, "rate_percent": 5}]'::jsonb,
   'json', 'fees', 'Designer fee by counted wins before this win (0–9: 15%, 10–49: 10%, 50+: 5%).')
on conflict (key) do update set value = excluded.value, description = excluded.description;

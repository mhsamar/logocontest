-- Monthly prize claim reminders (owner, 2026-10-11; REWARDS-HANDOFF §D): a winner who hasn't claimed is reminded
-- every few days, a set number of times. Both numbers are in Admin → Settings → Rewards.
insert into public.settings (key, value, type, "group", description) values
  ('rewards.claim_reminder_days', '3'::jsonb, 'int', 'rewards', 'Days between reminders to a monthly prize winner who hasn''t claimed yet.'),
  ('rewards.claim_reminders_max', '3'::jsonb, 'int', 'rewards', 'How many claim reminders a monthly prize winner gets at most (0 = none).')
on conflict (key) do nothing;

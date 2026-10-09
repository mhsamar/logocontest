-- logocontest.bd — client service fee (owner, 2026-10-08; BLUEPRINT.md §2, §7.1):
-- 25% of the prize, or 15% when the prize is above ৳30,000. Run after 0019 in Supabase → SQL Editor.
-- Safe to re-run, but re-running puts the fee back to these values.
-- Contests already paid keep what they paid; unpaid drafts are priced again at checkout.

insert into public.settings (key, value, type, "group", description) values
  ('fees.client_service_fee_percent', '25'::jsonb, 'int', 'fees', 'Service fee added on top of the prize, in percent.'),
  ('fees.client_service_fee_large_percent', '15'::jsonb, 'int', 'fees', 'Service fee for prizes above the amount below, in percent.'),
  ('fees.client_service_fee_large_from', '30000'::jsonb, 'int', 'fees', 'Prizes above this amount (taka) get the lower service fee.')
on conflict (key) do update set value = excluded.value, description = excluded.description;

-- 0070 Prices (owner, 2026-10-22): the client service fee is 25%, or 20% when the prize is above ৳50,000 (was 15%
-- above ৳30,000), and every add-on is free with a prize of ৳25,000 or more (extra days stay paid). From now on these
-- are changed on Admin › Pricing & fees. Run in Supabase → SQL Editor as one block. Safe to re-run (it sets these
-- values again, so run it again only if you want them back).

insert into public.settings (key, value, type, "group", description) values
  ('fees.client_service_fee_percent', '25'::jsonb, 'int', 'fees', 'Service fee added on top of the prize, in percent.'),
  ('fees.client_service_fee_large_percent', '20'::jsonb, 'int', 'fees', 'Service fee for prizes above the amount below, in percent.'),
  ('fees.client_service_fee_large_from', '50000'::jsonb, 'int', 'fees', 'Prizes above this amount (taka) get the lower service fee.'),
  ('upgrades.all_free_from', '25000'::jsonb, 'int', 'upgrades', 'Every add-on is free with a prize of this much or more (taka). Extra days stay paid. 0 = never free.')
on conflict (key) do update set value = excluded.value, updated_at = now();

-- Check: select key, value from public.settings where key in ('fees.client_service_fee_percent', 'fees.client_service_fee_large_percent', 'fees.client_service_fee_large_from', 'upgrades.all_free_from');
-- → 25, 20, 50000, 25000

-- 0059 Bangla QR (owner, 2026-10-15): a payment method for later, once Bangladesh Bank's Bangla QR API is out.
-- Off and locked in Admin › Payments › Methods until the API is connected (src/lib/payments/bangla-qr.ts).
alter table public.payment_methods drop constraint if exists payment_methods_key_check;
alter table public.payment_methods add constraint payment_methods_key_check check (key in ('bkash_personal', 'bkash_merchant', 'bkash_api', 'sslcommerz', 'bangla_qr', 'stripe'));
insert into public.payment_methods (key, enabled, account_number, position) values ('bangla_qr', false, null, 5)
on conflict (key) do nothing;
-- Card payments in dollars stay last.
update public.payment_methods set position = 6 where key = 'stripe' and position = 5;

notify pgrst, 'reload schema';

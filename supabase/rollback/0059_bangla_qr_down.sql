-- Undo 0059: removes the Bangla QR method.
delete from public.payment_methods where key = 'bangla_qr';
update public.payment_methods set position = 5 where key = 'stripe' and position = 6;
alter table public.payment_methods drop constraint if exists payment_methods_key_check;
alter table public.payment_methods add constraint payment_methods_key_check check (key in ('bkash_personal', 'bkash_merchant', 'bkash_api', 'sslcommerz', 'stripe'));

notify pgrst, 'reload schema';

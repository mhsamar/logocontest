-- Undo 0050_manual_payments_promos.sql (owner, 2026-10-14). Run only after the app is rolled back.
-- Removes Stripe's columns and the dollar settings, payment methods, manual payment proofs (the contests and payments they approved stay as they are), promo
-- codes and their uses, and QA transaction IDs. Empty the payment-proofs bucket first (Storage › payment-proofs ›
-- select all › Delete), then:
delete from storage.buckets where id = 'payment-proofs';
delete from public.settings where key in ('payments.usd_rate', 'payments.usd_markup_percent');
drop index if exists public.payments_provider_ref_idx;
alter table public.payments drop constraint if exists payments_currency_check;
alter table public.payments drop column if exists currency, drop column if exists charged_cents, drop column if exists provider_ref;
alter table public.pro_payments drop constraint if exists pro_payments_currency_check;
alter table public.pro_payments drop column if exists currency, drop column if exists charged_cents;
drop table if exists public.qa_txn_codes;
alter table public.contests drop column if exists promo_redemption_id;
drop function if exists public.reserve_promo(text, uuid, text[]);
drop table if exists public.promo_redemptions;
drop table if exists public.promo_codes;
drop table if exists public.manual_payments;
drop table if exists public.payment_methods;
notify pgrst, 'reload schema';

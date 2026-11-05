-- Undo 0084_pay_proof_methods.sql. Proofs sent by bank app or another way are kept only if they still fit the old
-- rules; delete or fix them first, or the last block fails.
update storage.buckets set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'] where id = 'site';
drop table if exists public.pay_events;
alter table public.manual_payments drop constraint if exists manual_payments_proof_needs;
alter table public.manual_payments drop constraint if exists manual_payments_txn_id_check;
alter table public.manual_payments add constraint manual_payments_txn_id_check check (txn_id ~ '^[A-Z0-9]{8,14}$');
alter table public.manual_payments alter column txn_id set not null;
alter table public.manual_payments drop column if exists sent_around;
alter table public.manual_payments drop column if exists amount_sent;
alter table public.manual_payments drop column if exists bank_name;
alter table public.manual_payments drop column if exists proof_method;

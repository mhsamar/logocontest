-- The new contest payment flow (owner, 2026-11-06; Design/logocontest-update PayV3/PayTrx/PayBank/PayWait): a payer
-- can say how they sent the money (their bKash app, a bank app, or another way such as an agent or someone else's
-- phone), the payment page's voice guide can be an uploaded MP3, and the team sees how many clients reach the payment
-- screen and how many choose "pay later".
-- Down migration: supabase/rollback/0084_pay_proof_methods_down.sql
-- Run in Supabase → SQL Editor, one block at a time.

-- Block 1. How the money was sent, and the details for a bank app or another way. -----------------------------------
alter table public.manual_payments add column if not exists proof_method text not null default 'bkash' check (proof_method in ('bkash', 'bank', 'other'));
alter table public.manual_payments add column if not exists bank_name text check (bank_name is null or char_length(bank_name) <= 60);
alter table public.manual_payments add column if not exists amount_sent int check (amount_sent is null or amount_sent > 0);
alter table public.manual_payments add column if not exists sent_around text check (sent_around is null or char_length(sent_around) <= 60);

-- Block 2. A bank receipt's reference can be longer than a bKash TrxID, and "another way" may have none. -------------
alter table public.manual_payments alter column txn_id drop not null;
alter table public.manual_payments drop constraint if exists manual_payments_txn_id_check;
alter table public.manual_payments add constraint manual_payments_txn_id_check check (txn_id is null or txn_id ~ '^[A-Z0-9]{6,24}$');
alter table public.manual_payments drop constraint if exists manual_payments_proof_needs;
alter table public.manual_payments add constraint manual_payments_proof_needs check (
  (proof_method = 'bkash' and txn_id is not null)
  or (proof_method = 'bank' and txn_id is not null and screenshot_path is not null)
  or (proof_method = 'other' and screenshot_path is not null and sender_number is not null)
);

-- Block 3. Who reached the payment screen, and who chose "pay later" (counts only; read by the team). ----------------
create table if not exists public.pay_events (
  id          uuid primary key default gen_random_uuid(),
  contest_id  uuid not null references public.contests (id) on delete cascade,
  user_id     uuid references public.profiles (id) on delete set null,
  event       text not null check (event in ('opened', 'later')),
  created_at  timestamptz not null default now()
);
create index if not exists pay_events_event_idx on public.pay_events (event, created_at desc);
create unique index if not exists pay_events_once on public.pay_events (contest_id, event);
alter table public.pay_events enable row level security;
drop policy if exists pay_events_read on public.pay_events;
create policy pay_events_read on public.pay_events for select using (public.admin_can('payments.view'));

-- Block 4. The voice guide's MP3 or M4A in the public site bucket (pictures only until now). -------------------------
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac']
 where id = 'site';

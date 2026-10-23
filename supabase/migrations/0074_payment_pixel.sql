-- 0074 Meta Pixel Purchase once per payment (owner, 2026-10-24). The contest payment's Purchase event is sent from the
-- client's browser; this column records the first browser that sent it, so a second phone or laptop opening the same
-- contest doesn't send it again. Only the server writes it.
-- Run in Supabase → SQL Editor. Safe to re-run.

alter table public.payments add column if not exists pixel_sent_at timestamptz;

notify pgrst, 'reload schema';

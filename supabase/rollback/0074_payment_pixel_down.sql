-- Rollback of 0074: Purchase is then only kept from repeating per browser. Run in Supabase → SQL Editor.

alter table public.payments drop column if exists pixel_sent_at;

notify pgrst, 'reload schema';

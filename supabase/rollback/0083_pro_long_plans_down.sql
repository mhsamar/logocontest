-- Rollback of 0083: only the monthly Pro plan again (plans already bought keep their end date).
-- Run in Supabase → SQL Editor.

alter table public.pro_payments drop column if exists months;
alter table public.pro_settings drop column if exists price_12m_bdt;
alter table public.pro_settings drop column if exists price_6m_bdt;

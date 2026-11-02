-- Pro for 6 and 12 months (owner, 2026-11-02): one payment for 6 months (৳1000) or 12 months (৳1500), the same Pro
-- features as the monthly plan (৳199, renewed each month). Both prices are changed in Admin › Pro plan.
-- Down migration: supabase/rollback/0083_pro_long_plans_down.sql
-- Run in Supabase → SQL Editor, one block at a time.

-- Block 1. The two prices. ------------------------------------------------------------------------------------------
alter table public.pro_settings add column if not exists price_6m_bdt int not null default 1000 check (price_6m_bdt between 1 and 1000000);
alter table public.pro_settings add column if not exists price_12m_bdt int not null default 1500 check (price_12m_bdt between 1 and 1000000);

-- Block 2. How many months each payment buys (1 for every payment before). ------------------------------------------
alter table public.pro_payments add column if not exists months int not null default 1 check (months in (1, 6, 12));

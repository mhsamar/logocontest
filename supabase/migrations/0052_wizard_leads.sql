-- New clients give their mobile number at the start of the contest wizard (owner, 2026-10-14), so the team can call
-- someone who started a contest but didn't finish signing up. One row per wizard visit; the admin sees them in
-- Admin > Unpaid contests. Rows older than 90 days are deleted by the lifecycle job.
-- Down migration: supabase/rollback/0052_wizard_leads_down.sql
create table if not exists public.wizard_leads (
  visit_id       uuid primary key,
  mobile         text not null check (mobile ~ '^\+8801[3-9][0-9]{8}$'),
  brand_name     text check (brand_name is null or char_length(brand_name) <= 200),
  service        text check (service is null or char_length(service) <= 60),
  furthest_step  smallint not null default 1 check (furthest_step between 1 and 12),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists wizard_leads_created_idx on public.wizard_leads (created_at desc);
create index if not exists wizard_leads_mobile_idx on public.wizard_leads (mobile);
alter table public.wizard_leads enable row level security;
drop policy if exists wizard_leads_admin on public.wizard_leads;
create policy wizard_leads_admin on public.wizard_leads for select using (public.admin_can('unpaid.view'));

notify pgrst, 'reload schema';

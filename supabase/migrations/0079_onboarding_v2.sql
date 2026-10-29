-- 0079 Onboarding v2 (owner, 2026-10-28; client-onboarding-v2-spec.md): /start-v2 saves the contest right after the
-- logo name and business type (step 2), shows the prize at step 3 and payment at step 4, and asks for the rest of the
-- brief after paying, filled in from the business type. The old /start wizard keeps working as before.
-- Run in Supabase → SQL Editor, ONE BLOCK AT A TIME, in order. Every block is safe to re-run.
-- Rollback: supabase/rollback/0079_onboarding_v2_down.sql.

-- ---- Block 1: a contest's description may be empty (the old wizard still asks for 20–300 letters in its own code) ----
alter table public.contests drop constraint if exists contests_business_description_check;
do $$
declare c record;
begin
  -- Any other check on the description (made under another name) goes too.
  for c in select conname from pg_constraint
            where conrelid = 'public.contests'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%business_description%'
              and conname <> 'contests_business_description_len'
  loop
    execute format('alter table public.contests drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.contests drop constraint if exists contests_business_description_len;
alter table public.contests add constraint contests_business_description_len check (char_length(business_description) <= 300);

-- ---- Block 2: how far a v2 client got, and which parts of the brief they changed --------------------------------------
-- last_step: 2 = logo name saved, 3 = saw the prizes, 4 = opened the payment step.
-- brief_completion: empty for contests made by the old wizard; for v2 {"v":2,"edited":[...],"acceptedAt":...}.
alter table public.contests
  add column if not exists last_step smallint check (last_step is null or last_step between 1 and 9),
  add column if not exists pricing_viewed_at timestamptz,
  add column if not exists package_selected_at timestamptz,
  add column if not exists brief_completion jsonb check (brief_completion is null or jsonb_typeof(brief_completion) = 'object');

-- ---- Block 3: wizard visits know which wizard they were, so the old drop-off chart and the v2 funnel don't mix ----------
alter table public.wizard_visits add column if not exists flow text not null default 'v1' check (flow in ('v1', 'v2'));

create or replace function public.record_wizard_step(p_visit_id uuid, p_step int, p_contest_id uuid, p_flow text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.wizard_visits (id, furthest_step, contest_id, flow)
  values (p_visit_id, p_step, p_contest_id, case when p_flow = 'v2' then 'v2' else 'v1' end)
  on conflict (id) do update
     set furthest_step = greatest(public.wizard_visits.furthest_step, excluded.furthest_step),
         contest_id = coalesce(excluded.contest_id, public.wizard_visits.contest_id),
         updated_at = now();
$$;
revoke all on function public.record_wizard_step(uuid, int, uuid, text) from public, anon, authenticated;

notify pgrst, 'reload schema';

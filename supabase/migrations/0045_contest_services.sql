-- Contest services (owner, 2026-10-13): logo now, more kinds of contest later (YouTube thumbnail, social post, …),
-- each switched on or off and set up in Admin → Services. The app keeps built-in defaults for the planned services;
-- a row here is written when an admin saves or switches a service.

-- 1. The services. Only the server (service role) reads and writes them.
create table if not exists public.contest_services (
  slug text primary key check (slug ~ '^[a-z][a-z0-9_]{1,39}$'),
  is_on boolean not null default false,
  position int not null default 0,
  def jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
alter table public.contest_services enable row level security;

-- 2. Which service a contest is for, and the answers to that service's brief questions (empty for logo contests).
alter table public.contests add column if not exists service text not null default 'logo' check (service ~ '^[a-z][a-z0-9_]{1,39}$');
alter table public.contests add column if not exists service_brief jsonb not null default '{}'::jsonb;
create index if not exists contests_service_idx on public.contests (service, status);

-- 3. The final files the winner must send, copied from the service when the contest is made (null = a logo contest:
--    AI, EPS, SVG, PDF, PNG and JPG). Same as 0021's submit_handover except it reads this list.
alter table public.contests add column if not exists final_types text[];

create or replace function public.submit_handover(p_handover_id uuid, p_designer_id uuid, p_fonts_note text, p_review_days int)
returns public.handovers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_h public.handovers;
  v_need text[];
  v_types int;
begin
  select * into v_h from public.handovers where id = p_handover_id for update;
  if not found or v_h.designer_id <> p_designer_id then
    raise exception 'handover % not found', p_handover_id using errcode = 'no_data_found';
  end if;
  if v_h.status not in ('awaiting_files', 'revision_requested') then
    raise exception 'handover % cannot be submitted now', p_handover_id;
  end if;
  select coalesce(nullif(final_types, '{}'), array['ai', 'eps', 'svg', 'pdf', 'png', 'jpg']) into v_need from public.contests where id = v_h.contest_id;
  select count(distinct file_type) into v_types from public.handover_files
   where handover_id = p_handover_id and file_type = any (v_need);
  if v_types < cardinality(v_need) then
    raise exception 'handover % is missing files', p_handover_id using errcode = 'check_violation';
  end if;

  update public.handovers
     set status = 'submitted',
         fonts_note = nullif(trim(p_fonts_note), ''),
         agreement_accepted_at = coalesce(agreement_accepted_at, now()),
         submitted_at = now(),
         review_due_at = now() + make_interval(days => p_review_days)
   where id = p_handover_id
  returning * into v_h;
  update public.contests set status = 'handover' where id = v_h.contest_id and status = 'winner_selected';
  return v_h;
end;
$$;
revoke all on function public.submit_handover(uuid, uuid, text, int) from public, anon, authenticated;

notify pgrst, 'reload schema';

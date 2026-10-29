-- Rollback of 0079: the v2 step and brief marks are dropped (v2 contests then look like old-wizard contests). The old
-- 20–300 letter rule for the description comes back only when no contest has a shorter one; otherwise only the 300
-- limit comes back (a check on rows that break it would stop approving their payments and every later change to them,
-- even by the system), and the old wizard keeps asking for 20–300 letters in its own code.
-- Run in Supabase → SQL Editor.

drop function if exists public.record_wizard_step(uuid, int, uuid, text);
alter table public.wizard_visits drop column if exists flow;

alter table public.contests
  drop column if exists brief_completion,
  drop column if exists package_selected_at,
  drop column if exists pricing_viewed_at,
  drop column if exists last_step;

alter table public.contests drop constraint if exists contests_business_description_len;
alter table public.contests drop constraint if exists contests_business_description_check;
do $$
begin
  if exists (select 1 from public.contests where char_length(business_description) < 20) then
    alter table public.contests add constraint contests_business_description_check check (char_length(business_description) <= 300);
    raise notice 'Some contests have a description under 20 letters: only the 300-letter limit is back.';
  else
    alter table public.contests add constraint contests_business_description_check check (char_length(business_description) between 20 and 300);
  end if;
end $$;

notify pgrst, 'reload schema';

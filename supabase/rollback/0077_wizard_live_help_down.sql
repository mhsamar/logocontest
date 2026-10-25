-- Rollback of 0077: the Unpaid page loses "Creating a contest right now", Watch and Offer help (the rest keeps working,
-- and Start a contest stops sending live updates quietly). Run in Supabase → SQL Editor. This deletes the help chats.

drop table if exists public.help_messages;
drop table if exists public.help_offers;
drop table if exists public.wizard_live;

notify pgrst, 'reload schema';

-- Undo 0046_pro_plan.sql (owner, 2026-10-13). Removes the Pro plan tables and everything in them (subscriptions,
-- payments, invites, contest chat, portfolio uploads, designer logo checks). Run only after the app is rolled back.

-- Designer logo checks have no contest; remove them before contest_id becomes required again.
delete from public.logo_checks where source = 'designer';
drop function if exists public.start_designer_logo_check(uuid, uuid, uuid, text, date, timestamptz, timestamptz, int);
alter table public.logo_checks drop constraint if exists logo_checks_designer_shape;
alter table public.logo_checks drop constraint if exists logo_checks_source_check;
alter table public.logo_checks add constraint logo_checks_source_check check (source in ('entry', 'upload'));
alter table public.logo_checks alter column contest_id set not null;

alter table public.contest_favorites drop column if exists reminded_2_at;
alter table public.contest_favorites drop column if exists reminded_24_at;
alter table public.contest_favorites drop column if exists remind;

-- Empty the pro-files bucket first (Storage › pro-files › select all › Delete), then:
delete from storage.buckets where id = 'pro-files';

drop table if exists public.entry_views;
drop table if exists public.contest_messages;
drop table if exists public.pro_preferences;
drop table if exists public.pro_activity_log;
drop table if exists public.designer_quality_score;
drop table if exists public.logo_check_usage;
drop table if exists public.portfolio_items;
drop table if exists public.contest_invites;
drop function if exists public.contest_invites_limit();
drop table if exists public.pro_funnel_events;
drop table if exists public.pro_payments;
drop sequence if exists public.pro_receipt_seq;
drop table if exists public.pro_subscriptions;
drop table if exists public.pro_settings;
drop function if exists public.admin_can(text);

notify pgrst, 'reload schema';

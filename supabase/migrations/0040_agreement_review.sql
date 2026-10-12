-- Admin "Designer agreements" review (owner, 2026-10-12; Design/agreements): a review status per signed agreement,
-- who reviewed it and when, an admin note, the rejection reason, when a new photo was asked for, and a copy of the
-- exact agreement text each designer signs from now on. The table stays server-only (RLS on, no policies).
alter table public.designer_agreements
  add column if not exists review_status text not null default 'needs_review'
    check (review_status in ('needs_review', 'approved', 'rejected', 'no_photo')),
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  add column if not exists reject_reason text check (reject_reason is null or char_length(reject_reason) <= 300),
  add column if not exists photo_requested_at timestamptz,
  add column if not exists signed_text jsonb;

-- Old agreements signed before ID photos were asked for start as "No ID photo".
update public.designer_agreements set review_status = 'no_photo' where id_front_path is null and review_status = 'needs_review';

notify pgrst, 'reload schema';

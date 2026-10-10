-- logocontest.bd - ID photos on the designer agreement, address in parts, pictures on copy claims
-- (owner, 2026-10-10; Design/admin/ADMIN-HANDOFF.md "Agreements"). Run after 0031. Safe to re-run.
-- Only the server (service role) reads and writes these: the tables keep row level security with no
-- policies, and both buckets are private. Admins see the pictures through short signed links.

-- 1. Designer agreement ---------------------------------------------------------------------------
-- The address as the designer typed it (house, road, area, post code, country); `address` keeps the
-- one-line version that the rest of the site already shows.
alter table public.designer_agreements add column if not exists address_parts jsonb;
-- Photo of the ID card, passport or birth certificate. The back is asked for a national ID card only.
alter table public.designer_agreements add column if not exists id_front_path text;
alter table public.designer_agreements add column if not exists id_back_path text;
alter table public.designer_agreements add column if not exists id_photo_at timestamptz;

-- 2. Copy claims: up to 3 pictures that show the copy ----------------------------------------------
alter table public.copy_claims add column if not exists evidence_paths text[] not null default '{}';
do $$ begin
  alter table public.copy_claims add constraint copy_claims_evidence_paths_max check (cardinality(evidence_paths) <= 3);
exception when duplicate_object then null; end $$;

-- 3. Private buckets ---------------------------------------------------------------------------------
-- The server re-saves every picture as JPEG (which also drops location data from phone photos).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('id-documents', 'id-documents', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('claim-files', 'claim-files', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- logocontest.bd — private storage for the winner's final files (owner, 2026-10-08; BLUEPRINT.md §9.3).
-- AI, EPS, SVG, PDF, PNG, JPG and ZIP, up to 50 MB each. Browsers label AI/EPS files differently,
-- so the bucket takes any type and the server checks the file extension instead.
-- Run after 0021 in Supabase → SQL Editor. Safe to re-run.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('handover-files', 'handover-files', false, 52428800, null)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = null;

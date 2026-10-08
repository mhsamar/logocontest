-- logocontest.bd — profile photos (owner, 2026-10-08; UI-JOURNEY D-12, C-20).
-- Run after 0009 in Supabase → SQL Editor. Safe to re-run.

-- Public bucket: profile photos are shown on public profiles. Uploads go through
-- one-time signed URLs made by the server, so nobody can write here directly.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 0072 Reference photo storage limits (owner, 2026-10-22). Clients can now add reference photos to a live contest and
-- the team can add them from Admin › Contests, so the contest-files bucket itself refuses anything but JPG, PNG and
-- PDF, and anything over 50 MB. The real limit (limits.brief_file_max_mb, 5 MB by default) is still checked by the
-- server against the stored file; this is only a ceiling in case someone uploads without recording the file.
-- Run in Supabase → SQL Editor. Safe to re-run.

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'application/pdf'],
    file_size_limit = 52428800
where id = 'contest-files';

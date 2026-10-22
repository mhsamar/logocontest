-- Rollback of 0072: the contest-files bucket without its own type and size limits again (the server still checks them).
-- Run in Supabase → SQL Editor.

update storage.buckets set allowed_mime_types = null, file_size_limit = null where id = 'contest-files';

-- A name for each mockup of a design (owner, 2026-10-11): the designer names every image when submitting (it starts
-- from the file name). Shown under the image in the design viewer.
alter table public.entry_images add column if not exists label text;
alter table public.entry_images drop constraint if exists entry_images_label_len;
alter table public.entry_images add constraint entry_images_label_len check (label is null or char_length(label) <= 60);

-- Хичээлийн PowerPoint (.ppt, .pptx) — SQL Editor-т Run хийнэ.

alter table lessons add column if not exists file_url text;
alter table lessons add column if not exists file_name text;
alter table lessons add column if not exists file_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-files',
  'lesson-files',
  true,
  52428800,
  array[
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read lesson files" on storage.objects;
drop policy if exists "Teachers upload lesson files" on storage.objects;
drop policy if exists "Teachers update lesson files" on storage.objects;
drop policy if exists "Teachers delete lesson files" on storage.objects;

-- Сурагч болон PowerPoint үзүүлэгч уншина
create policy "Public read lesson files"
  on storage.objects for select
  using (bucket_id = 'lesson-files');

create policy "Teachers upload lesson files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'lesson-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Teachers update lesson files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'lesson-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Teachers delete lesson files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'lesson-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

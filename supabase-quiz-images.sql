-- Шалгалтын зураг (Supabase Storage) — SQL Editor-т Run хийнэ.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quiz-images',
  'quiz-images',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read quiz images" on storage.objects;
drop policy if exists "Teachers upload quiz images" on storage.objects;
drop policy if exists "Teachers update quiz images" on storage.objects;
drop policy if exists "Teachers delete quiz images" on storage.objects;

-- Хэн ч уншиж болно (сурагч харна)
create policy "Public read quiz images"
  on storage.objects for select
  using (bucket_id = 'quiz-images');

-- Зөвхөн нэвтэрсэн багш өөрийн фолдерт байршуулна
create policy "Teachers upload quiz images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'quiz-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Teachers update quiz images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'quiz-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Teachers delete quiz images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'quiz-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

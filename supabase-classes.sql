-- Анги үүсгэх — одоо байгаа database дээр ажиллуулах migration
-- Supabase SQL Editor-т энэ файлыг Run хийнэ.

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade int not null,
  section text not null,
  join_code text not null unique,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists classes_teacher_id_idx on classes(teacher_id);

alter table classes enable row level security;

drop policy if exists "Teachers read own classes" on classes;
drop policy if exists "Teachers insert own classes" on classes;
drop policy if exists "Teachers delete own classes" on classes;

-- Багш зөвхөн өөрийн ангийг уншина / үүсгэнэ / устгана
create policy "Teachers read own classes" on classes
  for select to authenticated
  using (teacher_id = auth.uid());

create policy "Teachers insert own classes" on classes
  for insert to authenticated
  with check (teacher_id = auth.uid());

create policy "Teachers delete own classes" on classes
  for delete to authenticated
  using (teacher_id = auth.uid());

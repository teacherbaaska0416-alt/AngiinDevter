-- Ангийн сурагчид — одоо байгаа database дээр ажиллуулах migration
-- Supabase SQL Editor-т энэ файлыг Run хийнэ.
-- Хэрэв өмнө нь хуучин students хүснэгт байсан бол дараа нь supabase-students-v2.sql-ийг Run хийнэ.

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  last_name text not null,
  first_name text not null,
  name text not null,
  username text not null,
  student_no int,
  created_at timestamptz not null default now()
);

create index if not exists students_class_id_idx on students(class_id);
create unique index if not exists students_username_key on students (username);
create unique index if not exists students_class_name_key on students (class_id, last_name, first_name);

alter table students enable row level security;

drop policy if exists "Teachers read class students" on students;
drop policy if exists "Teachers insert class students" on students;
drop policy if exists "Teachers delete class students" on students;

-- Багш зөвхөн өөрийн ангийн сурагчдыг удирдана
create policy "Teachers read class students" on students
  for select to authenticated
  using (
    exists (
      select 1 from classes
      where classes.id = students.class_id
        and classes.teacher_id = auth.uid()
    )
  );

create policy "Teachers insert class students" on students
  for insert to authenticated
  with check (
    exists (
      select 1 from classes
      where classes.id = students.class_id
        and classes.teacher_id = auth.uid()
    )
  );

create policy "Teachers delete class students" on students
  for delete to authenticated
  using (
    exists (
      select 1 from classes
      where classes.id = students.class_id
        and classes.teacher_id = auth.uid()
    )
  );

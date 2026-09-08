-- Ангийн Дэвтэр — Supabase schema
-- Supabase project-ийнхоо SQL Editor-т энэ бүгдийг хуулж Run дарна уу.

create extension if not exists "pgcrypto";

create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  questions jsonb not null,
  duration_minutes int not null default 30,
  is_open boolean not null default false,
  class_id uuid,
  grade int,
  for_grade boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  quiz_id uuid,
  quiz_title text not null,
  subject text not null,
  score int not null,
  total int not null,
  details jsonb not null default '[]'::jsonb,
  date timestamptz not null default now()
);

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

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'quizzes_class_id_fkey'
  ) then
    alter table quizzes
      add constraint quizzes_class_id_fkey
      foreign key (class_id) references classes(id) on delete set null;
  end if;
end $$;

create index if not exists quizzes_class_id_idx on quizzes(class_id);
create index if not exists quizzes_grade_idx on quizzes(grade);

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

-- Row Level Security
alter table lessons enable row level security;
alter table quizzes enable row level security;
alter table attempts enable row level security;
alter table classes enable row level security;
alter table students enable row level security;

-- Унших: хэн ч (сурагч link-ээр орж хичээл/шалгалт харна)
create policy "Public read lessons" on lessons for select using (true);
create policy "Public read quizzes" on quizzes for select using (true);
create policy "Public read attempts" on attempts for select using (true);

-- Бичих/устгах: зөвхөн нэвтэрсэн багш (Supabase Auth)
create policy "Teachers insert lessons" on lessons for insert to authenticated with check (true);
create policy "Teachers delete lessons" on lessons for delete to authenticated using (true);
create policy "Teachers insert quizzes" on quizzes for insert to authenticated with check (true);
create policy "Teachers update quizzes" on quizzes for update to authenticated using (true) with check (true);
create policy "Teachers delete quizzes" on quizzes for delete to authenticated using (true);

-- Сурагч шалгалтын үр дүн илгээнэ (нэрээр, нэвтрэлтгүй)
create policy "Public insert attempts" on attempts for insert with check (true);

-- Анги: багш зөвхөн өөрийнхөө ангийг удирдана
create policy "Teachers read own classes" on classes
  for select to authenticated
  using (teacher_id = auth.uid());

create policy "Teachers insert own classes" on classes
  for insert to authenticated
  with check (teacher_id = auth.uid());

create policy "Teachers delete own classes" on classes
  for delete to authenticated
  using (teacher_id = auth.uid());

-- Сурагчид: багш зөвхөн өөрийн ангийн сурагчдыг удирдана
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

-- Сурагч нэвтрэх нэрээр нэвтрэх (anon-д зөвхөн нэг мөр буцаана)
create or replace function lookup_student_login(p_username text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  if p_username is null or length(trim(p_username)) = 0 then
    return null;
  end if;

  select json_build_object(
    'id', s.id,
    'class_id', s.class_id,
    'last_name', s.last_name,
    'first_name', s.first_name,
    'name', s.name,
    'username', s.username,
    'student_no', s.student_no,
    'class_name', c.name,
    'class_grade', c.grade
  )
  into result
  from students s
  left join classes c on c.id = s.class_id
  where lower(s.username) = lower(trim(p_username))
  limit 1;

  return result;
end;
$$;

revoke all on function lookup_student_login(text) from public;
grant execute on function lookup_student_login(text) to anon, authenticated;

-- Шалгалтын зураг (Storage)
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

create policy "Public read quiz images"
  on storage.objects for select
  using (bucket_id = 'quiz-images');

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

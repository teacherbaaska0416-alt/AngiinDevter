-- Багшийн заах хичээлийн жагсаалт — SQL Editor-т Run хийнэ.

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  grade int,
  created_at timestamptz not null default now(),
  constraint subjects_grade_check check (grade is null or (grade >= 6 and grade <= 12))
);

create index if not exists subjects_teacher_id_idx on subjects(teacher_id);
create unique index if not exists subjects_teacher_grade_name_key
  on subjects (teacher_id, coalesce(grade, 0), lower(name));

alter table subjects enable row level security;

drop policy if exists "Teachers read own subjects" on subjects;
drop policy if exists "Teachers insert own subjects" on subjects;
drop policy if exists "Teachers delete own subjects" on subjects;

create policy "Teachers read own subjects"
  on subjects for select to authenticated
  using (teacher_id = auth.uid());

create policy "Teachers insert own subjects"
  on subjects for insert to authenticated
  with check (teacher_id = auth.uid());

create policy "Teachers delete own subjects"
  on subjects for delete to authenticated
  using (teacher_id = auth.uid());

drop policy if exists "Teachers update own subjects" on subjects;
create policy "Teachers update own subjects"
  on subjects for update to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

-- Хичээлийг 6–12-р ангиар бүлэглэх — Supabase SQL Editor-т Run хийнэ.

alter table subjects add column if not exists grade int;

alter table subjects drop constraint if exists subjects_grade_check;
alter table subjects
  add constraint subjects_grade_check
  check (grade is null or (grade >= 6 and grade <= 12));

drop index if exists subjects_teacher_name_key;

create unique index if not exists subjects_teacher_grade_name_key
  on subjects (teacher_id, coalesce(grade, 0), lower(name));

drop policy if exists "Teachers update own subjects" on subjects;
create policy "Teachers update own subjects"
  on subjects for update to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

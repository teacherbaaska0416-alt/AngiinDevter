-- Материалыг анги + хичээлээр салгах — Supabase SQL Editor-т Run хийнэ.
-- Өмнө нь supabase-subjects.sql болон supabase-subjects-grade.sql ажилласан байх ёстой.

alter table lessons add column if not exists subject_id uuid references subjects(id) on delete set null;
alter table lessons add column if not exists grade int;

alter table lessons drop constraint if exists lessons_grade_check;
alter table lessons
  add constraint lessons_grade_check
  check (grade is null or (grade >= 6 and grade <= 12));

create index if not exists lessons_subject_id_idx on lessons(subject_id);

drop policy if exists "Teachers update lessons" on lessons;
create policy "Teachers update lessons"
  on lessons for update to authenticated
  using (true)
  with check (true);

-- Нэр нь ганцхан хичээлд таарч байгаа хуучин материалыг тэр хичээлд холбоно.
update lessons as material
set subject_id = subject.id,
    grade = subject.grade
from subjects as subject
where material.subject_id is null
  and lower(material.subject) = lower(subject.name)
  and (
    select count(*)
    from subjects as same_name
    where lower(same_name.name) = lower(material.subject)
  ) = 1;

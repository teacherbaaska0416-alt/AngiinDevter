-- Шалгалтыг анги / түвшинд харуулах — SQL Editor-т Run хийнэ.

alter table quizzes add column if not exists class_id uuid;
alter table quizzes add column if not exists grade int;
alter table quizzes add column if not exists for_grade boolean;

update quizzes set for_grade = false where for_grade is null;

alter table quizzes alter column for_grade set default false;
alter table quizzes alter column for_grade set not null;

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

-- Сурагчийн нэвтрэлтэд ангийн түвшин (grade) буцаана
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

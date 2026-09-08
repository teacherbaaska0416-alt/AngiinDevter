-- Шалгалтын хугацаа + эхлүүлэх эрх — SQL Editor-т Run хийнэ.

alter table quizzes add column if not exists duration_minutes int;
alter table quizzes add column if not exists is_open boolean;

update quizzes set duration_minutes = 30 where duration_minutes is null;
update quizzes set is_open = false where is_open is null;

alter table quizzes alter column duration_minutes set default 30;
alter table quizzes alter column is_open set default false;
alter table quizzes alter column duration_minutes set not null;
alter table quizzes alter column is_open set not null;

-- Багш шалгалт засах / нээх / хаах
drop policy if exists "Teachers update quizzes" on quizzes;
create policy "Teachers update quizzes" on quizzes
  for update to authenticated
  using (true)
  with check (true);

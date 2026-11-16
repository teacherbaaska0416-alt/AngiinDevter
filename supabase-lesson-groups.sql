-- Багш хичээлээ өөрөө бүлэглэнэ. Supabase SQL Editor-т Run хийнэ.
-- Өмнө нь supabase-subjects.sql ажилласан байх ёстой.

create table if not exists lesson_groups (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  grade int,
  parent_id uuid references lesson_groups(id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table lesson_groups alter column subject_id drop not null;
alter table lesson_groups add column if not exists grade int;
alter table lesson_groups add column if not exists parent_id uuid references lesson_groups(id) on delete cascade;

alter table lesson_groups drop constraint if exists lesson_groups_grade_check;
alter table lesson_groups
  add constraint lesson_groups_grade_check
  check (grade is null or (grade >= 6 and grade <= 12));

create index if not exists lesson_groups_subject_id_idx on lesson_groups(subject_id);
create index if not exists lesson_groups_parent_id_idx on lesson_groups(parent_id);
drop index if exists lesson_groups_subject_name_key;
create unique index if not exists lesson_groups_grade_name_key
  on lesson_groups (teacher_id, grade, lower(name))
  where parent_id is null and subject_id is null and grade is not null;
create unique index if not exists lesson_groups_parent_name_key
  on lesson_groups (parent_id, lower(name))
  where parent_id is not null;

alter table lesson_groups enable row level security;

drop policy if exists "Public read lesson groups" on lesson_groups;
drop policy if exists "Teachers insert own lesson groups" on lesson_groups;
drop policy if exists "Teachers update own lesson groups" on lesson_groups;
drop policy if exists "Teachers delete own lesson groups" on lesson_groups;

create policy "Public read lesson groups"
  on lesson_groups for select
  using (true);

create policy "Teachers insert own lesson groups"
  on lesson_groups for insert to authenticated
  with check (teacher_id = auth.uid());

create policy "Teachers update own lesson groups"
  on lesson_groups for update to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy "Teachers delete own lesson groups"
  on lesson_groups for delete to authenticated
  using (teacher_id = auth.uid());

alter table lessons add column if not exists group_id uuid references lesson_groups(id) on delete set null;
create index if not exists lessons_group_id_idx on lessons(group_id);

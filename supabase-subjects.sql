-- Багшийн заах хичээлийн жагсаалт — SQL Editor-т Run хийнэ.

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists subjects_teacher_id_idx on subjects(teacher_id);
create unique index if not exists subjects_teacher_name_key
  on subjects (teacher_id, lower(name));

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

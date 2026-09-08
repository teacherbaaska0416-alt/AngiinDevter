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

create table if not exists student_login_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  student_name text not null,
  class_name text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

alter table student_login_requests drop constraint if exists student_login_requests_status_check;
alter table student_login_requests
  add constraint student_login_requests_status_check
  check (status in ('pending', 'approved', 'rejected', 'cancelled', 'expired'));

create index if not exists student_login_requests_teacher_status_idx
  on student_login_requests (teacher_id, status, created_at desc);
create index if not exists student_login_requests_student_status_idx
  on student_login_requests (student_id, status);

alter table student_login_requests enable row level security;
alter table student_login_requests replica identity full;

drop policy if exists "Teachers read login requests" on student_login_requests;
create policy "Teachers read login requests"
  on student_login_requests for select to authenticated
  using (teacher_id = auth.uid());

create or replace function student_login_payload(p_student_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
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
  from students s
  left join classes c on c.id = s.class_id
  where s.id = p_student_id
  limit 1;
$$;

create or replace function request_student_login(p_username text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  s students%rowtype;
  cname text;
  existing uuid;
  new_id uuid;
begin
  if p_username is null or length(trim(p_username)) = 0 then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  select * into s from students where lower(username) = lower(trim(p_username)) limit 1;
  if s.id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  select name into cname from classes where id = s.class_id;

  update student_login_requests
     set status = 'expired', decided_at = now()
   where student_id = s.id and status = 'pending' and created_at <= now() - interval '15 minutes';

  select id into existing
  from student_login_requests
  where student_id = s.id and status = 'pending' and created_at > now() - interval '15 minutes'
  order by created_at desc
  limit 1;

  if existing is not null then
    return json_build_object(
      'ok', true,
      'request_id', existing,
      'status', 'pending',
      'student_name', coalesce(nullif(s.name, ''), trim(both from concat_ws(' ', s.last_name, s.first_name))),
      'class_name', coalesce(cname, ''),
      'username', s.username
    );
  end if;

  insert into student_login_requests (
    student_id, class_id, teacher_id, username, student_name, class_name, status
  )
  select
    s.id,
    s.class_id,
    cl.teacher_id,
    s.username,
    coalesce(nullif(s.name, ''), trim(both from concat_ws(' ', s.last_name, s.first_name))),
    coalesce(cl.name, ''),
    'pending'
  from classes cl
  where cl.id = s.class_id
  returning id into new_id;

  if new_id is null then
    return json_build_object('ok', false, 'error', 'no_class');
  end if;

  return json_build_object(
    'ok', true,
    'request_id', new_id,
    'status', 'pending',
    'student_name', coalesce(nullif(s.name, ''), trim(both from concat_ws(' ', s.last_name, s.first_name))),
    'class_name', coalesce(cname, ''),
    'username', s.username
  );
end;
$$;

create or replace function get_student_login_request(p_request_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  r student_login_requests%rowtype;
begin
  if p_request_id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  select * into r from student_login_requests where id = p_request_id;
  if r.id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if r.status = 'pending' and r.created_at <= now() - interval '15 minutes' then
    update student_login_requests
       set status = 'expired', decided_at = now()
     where id = r.id and status = 'pending';
    return json_build_object('ok', true, 'status', 'expired');
  end if;

  if r.status = 'approved' then
    return json_build_object('ok', true, 'status', 'approved', 'student', student_login_payload(r.student_id));
  end if;

  return json_build_object('ok', true, 'status', r.status);
end;
$$;

create or replace function cancel_student_login_request(p_request_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_request_id is null then
    return json_build_object('ok', false);
  end if;
  update student_login_requests
     set status = 'cancelled', decided_at = now()
   where id = p_request_id and status = 'pending';
  return json_build_object('ok', true);
end;
$$;

create or replace function decide_student_login(p_request_id uuid, p_approved boolean)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  new_status text;
  updated int;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  new_status := case when p_approved then 'approved' else 'rejected' end;
  update student_login_requests
     set status = new_status, decided_at = now()
   where id = p_request_id and teacher_id = auth.uid() and status = 'pending';
  get diagnostics updated = row_count;
  if updated = 0 then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  return json_build_object('ok', true, 'status', new_status);
end;
$$;

revoke all on function student_login_payload(uuid) from public;
revoke all on function request_student_login(text) from public;
revoke all on function get_student_login_request(uuid) from public;
revoke all on function cancel_student_login_request(uuid) from public;
revoke all on function decide_student_login(uuid, boolean) from public;
grant execute on function request_student_login(text) to anon, authenticated;
grant execute on function get_student_login_request(uuid) to anon, authenticated;
grant execute on function cancel_student_login_request(uuid) to anon, authenticated;
grant execute on function decide_student_login(uuid, boolean) to authenticated;

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

alter table quizzes replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'quizzes'
  ) then
    execute 'alter publication supabase_realtime add table quizzes';
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'student_login_requests'
  ) then
    execute 'alter publication supabase_realtime add table student_login_requests';
  end if;
end $$;


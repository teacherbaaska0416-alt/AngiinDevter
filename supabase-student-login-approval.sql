-- Сурагч нэвтрэхэд багш зөвшөөрөх — SQL Editor-т Run хийнэ.

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
drop policy if exists "Teachers update login requests" on student_login_requests;

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

  select *
    into s
  from students
  where lower(username) = lower(trim(p_username))
  limit 1;

  if s.id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  select name into cname from classes where id = s.class_id;

  update student_login_requests
     set status = 'expired',
         decided_at = now()
   where student_id = s.id
     and status = 'pending'
     and created_at <= now() - interval '15 minutes';

  select id
    into existing
  from student_login_requests
  where student_id = s.id
    and status = 'pending'
    and created_at > now() - interval '15 minutes'
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
    return json_build_object(
      'ok', true,
      'status', 'approved',
      'student', student_login_payload(r.student_id)
    );
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
     set status = 'cancelled',
         decided_at = now()
   where id = p_request_id
     and status = 'pending';

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
     set status = new_status,
         decided_at = now()
   where id = p_request_id
     and teacher_id = auth.uid()
     and status = 'pending';

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

do $$
begin
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

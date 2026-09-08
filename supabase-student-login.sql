-- Сурагч нэвтрэх нэрээр нэвтрэх — SQL Editor-т Run хийнэ.

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

-- Сурагч: Овог, Нэр, нэвтрэх нэр, дугаар — одоо байгаа students хүснэгтийг шинэчлэх
-- Supabase SQL Editor-т энэ файлыг Run хийнэ.

alter table students add column if not exists last_name text;
alter table students add column if not exists first_name text;
alter table students add column if not exists username text;
alter table students add column if not exists student_no int;

-- Хуучин нэг мөртэй "name"-ийг задлана (зайгаар: эхний үг=овог, үлдсэн=нэр)
update students
set
  last_name = case
    when coalesce(last_name, '') <> '' then last_name
    when position(' ' in trim(coalesce(name, ''))) > 0 then trim(split_part(trim(name), ' ', 1))
    else 'Овог'
  end,
  first_name = case
    when coalesce(first_name, '') <> '' then first_name
    when position(' ' in trim(coalesce(name, ''))) > 0 then trim(substring(trim(name) from position(' ' in trim(name)) + 1))
    else nullif(trim(coalesce(name, '')), '')
  end
where coalesce(last_name, '') = '' or coalesce(first_name, '') = '';

update students
set first_name = coalesce(nullif(trim(first_name), ''), 'Нэр')
where coalesce(first_name, '') = '';

update students
set last_name = coalesce(nullif(trim(last_name), ''), 'Овог')
where coalesce(last_name, '') = '';

-- Нэвтрэх нэр байхгүй бол түр uuid-аас гаргана
update students
set username = 's' || substr(replace(id::text, '-', ''), 1, 10)
where coalesce(username, '') = '';

do $$
begin
  if not exists (select 1 from students where coalesce(last_name, '') = '') then
    alter table students alter column last_name set not null;
  end if;
  if not exists (select 1 from students where coalesce(first_name, '') = '') then
    alter table students alter column first_name set not null;
  end if;
  if not exists (select 1 from students where coalesce(username, '') = '') then
    alter table students alter column username set not null;
  end if;
exception when others then
  null;
end $$;

alter table students drop constraint if exists students_class_id_name_key;

do $$
begin
  create unique index if not exists students_username_key on students (username);
exception when others then
  null;
end $$;

do $$
begin
  create unique index if not exists students_class_name_key on students (class_id, last_name, first_name);
exception when others then
  null;
end $$;

update students
set name = trim(last_name || ' ' || first_name)
where name is distinct from trim(last_name || ' ' || first_name);

notify pgrst, 'reload schema';

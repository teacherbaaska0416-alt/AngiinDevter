-- Сурагч: Овог, Нэр, нэвтрэх нэр — одоо байгаа students хүснэгтийг шинэчлэх
-- Supabase SQL Editor-т энэ файлыг Run хийнэ.

alter table students add column if not exists last_name text;
alter table students add column if not exists first_name text;
alter table students add column if not exists username text;

-- Хуучин нэг мөртэй "name"-ийг задлана (зайгаар: эхний үг=овог, үлдсэн=нэр)
update students
set
  last_name = case
    when coalesce(last_name, '') <> '' then last_name
    when position(' ' in trim(name)) > 0 then trim(split_part(trim(name), ' ', 1))
    else 'Овог'
  end,
  first_name = case
    when coalesce(first_name, '') <> '' then first_name
    when position(' ' in trim(name)) > 0 then trim(substring(trim(name) from position(' ' in trim(name)) + 1))
    else trim(name)
  end
where coalesce(last_name, '') = '' or coalesce(first_name, '') = '';

-- Нэвтрэх нэр байхгүй бол түр uuid-аас гаргана (апп дараа нь зөв форматаар үүсгэнэ)
update students
set username = 's' || substr(replace(id::text, '-', ''), 1, 10)
where coalesce(username, '') = '';

alter table students alter column last_name set not null;
alter table students alter column first_name set not null;
alter table students alter column username set not null;

-- Хуучин unique(class_id, name)-ийг авч, username unique болгоно
alter table students drop constraint if exists students_class_id_name_key;
create unique index if not exists students_username_key on students (username);
create unique index if not exists students_class_name_key on students (class_id, last_name, first_name);

-- name баганыг Овог + Нэр-ээр шинэчилнэ (харагдах нэр)
update students
set name = trim(last_name || ' ' || first_name)
where name is distinct from trim(last_name || ' ' || first_name);

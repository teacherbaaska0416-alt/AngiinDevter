-- Шалгалтыг дахин өгөх зөвшөөрөл — SQL Editor-т Run хийнэ.

create table if not exists quiz_retake_grants (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  granted_at timestamptz not null default now(),
  consumed_at timestamptz
);

create index if not exists quiz_retake_grants_quiz_idx on quiz_retake_grants (quiz_id);
create index if not exists quiz_retake_grants_student_idx on quiz_retake_grants (student_id);

create unique index if not exists quiz_retake_grants_pending_key
  on quiz_retake_grants (quiz_id, student_id)
  where consumed_at is null;

alter table quiz_retake_grants enable row level security;

drop policy if exists "Public read retake grants" on quiz_retake_grants;
drop policy if exists "Teachers insert retake grants" on quiz_retake_grants;
drop policy if exists "Teachers update retake grants" on quiz_retake_grants;

create policy "Public read retake grants"
  on quiz_retake_grants for select using (true);

create policy "Teachers insert retake grants"
  on quiz_retake_grants for insert to authenticated with check (true);

create policy "Teachers update retake grants"
  on quiz_retake_grants for update to authenticated using (true) with check (true);

create or replace function consume_quiz_retake_grant(p_quiz_id uuid, p_student_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_quiz_id is null or p_student_id is null then
    return json_build_object('ok', false);
  end if;

  update quiz_retake_grants
     set consumed_at = now()
   where quiz_id = p_quiz_id
     and student_id = p_student_id
     and consumed_at is null;

  return json_build_object('ok', true);
end;
$$;

revoke all on function consume_quiz_retake_grant(uuid, uuid) from public;
grant execute on function consume_quiz_retake_grant(uuid, uuid) to anon, authenticated;

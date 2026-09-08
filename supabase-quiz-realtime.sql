-- Шалгалт нээх/хаах-ыг сурагчид шууд харуулах. SQL Editor-т Run хийнэ.

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
end $$;

-- Багшийн нэвтрэлт — одоо байгаа database дээр ажиллуулах migration
-- Supabase SQL Editor-т энэ файлыг Run хийнэ.

drop policy if exists "Public insert lessons" on lessons;
drop policy if exists "Public delete lessons" on lessons;
drop policy if exists "Public insert quizzes" on quizzes;
drop policy if exists "Public delete quizzes" on quizzes;

create policy "Teachers insert lessons" on lessons for insert to authenticated with check (true);
create policy "Teachers delete lessons" on lessons for delete to authenticated using (true);
create policy "Teachers insert quizzes" on quizzes for insert to authenticated with check (true);
create policy "Teachers delete quizzes" on quizzes for delete to authenticated using (true);

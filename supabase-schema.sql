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
  date timestamptz not null default now()
);

-- Row Level Security
alter table lessons enable row level security;
alter table quizzes enable row level security;
alter table attempts enable row level security;

-- Анги доторх хэрэглээнд зориулж энгийн (нээлттэй) policy тавьж байна:
-- хэн ч (anon key ашиглан) унших, нэмэх, устгах боломжтой.
-- Хэрэв ирээдүйд багш/сурагчийн нэвтрэлт (Supabase Auth) нэмбэл эдгээр policy-г
-- нарийвчилж, зөвхөн нэвтэрсэн багш л нэмэх/устгах эрхтэй болгож болно.

create policy "Public read lessons" on lessons for select using (true);
create policy "Public insert lessons" on lessons for insert with check (true);
create policy "Public delete lessons" on lessons for delete using (true);

create policy "Public read quizzes" on quizzes for select using (true);
create policy "Public insert quizzes" on quizzes for insert with check (true);
create policy "Public delete quizzes" on quizzes for delete using (true);

create policy "Public read attempts" on attempts for select using (true);
create policy "Public insert attempts" on attempts for insert with check (true);

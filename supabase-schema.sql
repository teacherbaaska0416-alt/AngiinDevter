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

-- Унших: хэн ч (сурагч link-ээр орж хичээл/шалгалт харна)
create policy "Public read lessons" on lessons for select using (true);
create policy "Public read quizzes" on quizzes for select using (true);
create policy "Public read attempts" on attempts for select using (true);

-- Бичих/устгах: зөвхөн нэвтэрсэн багш (Supabase Auth)
create policy "Teachers insert lessons" on lessons for insert to authenticated with check (true);
create policy "Teachers delete lessons" on lessons for delete to authenticated using (true);
create policy "Teachers insert quizzes" on quizzes for insert to authenticated with check (true);
create policy "Teachers delete quizzes" on quizzes for delete to authenticated using (true);

-- Сурагч шалгалтын үр дүн илгээнэ (нэрээр, нэвтрэлтгүй)
create policy "Public insert attempts" on attempts for insert with check (true);

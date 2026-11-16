-- Арван хурууны дасгалын засвар — Supabase SQL Editor-т Run хийнэ.

create table if not exists typing_drills (
  id text primary key,
  title text not null,
  focus text not null default '',
  tip text not null default '',
  prompt text not null,
  goal_wpm int not null default 12,
  updated_at timestamptz not null default now()
);

alter table typing_drills enable row level security;

drop policy if exists "Public read typing drills" on typing_drills;
drop policy if exists "Teachers insert typing drills" on typing_drills;
drop policy if exists "Teachers update typing drills" on typing_drills;
drop policy if exists "Teachers delete typing drills" on typing_drills;

create policy "Public read typing drills"
  on typing_drills for select
  using (true);

create policy "Teachers insert typing drills"
  on typing_drills for insert to authenticated
  with check (true);

create policy "Teachers update typing drills"
  on typing_drills for update to authenticated
  using (true)
  with check (true);

create policy "Teachers delete typing drills"
  on typing_drills for delete to authenticated
  using (true);

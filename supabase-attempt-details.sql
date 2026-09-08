-- Шалгалтын хариу — асуулт бүрийн онооны задаргаа
-- Supabase SQL Editor-т Run хийнэ.

alter table attempts add column if not exists details jsonb;

update attempts set details = '[]'::jsonb where details is null;

alter table attempts alter column details set default '[]'::jsonb;
alter table attempts alter column details set not null;

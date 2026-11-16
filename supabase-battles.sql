-- Тулааны хүсэлт. Supabase SQL Editor-т Run хийнэ.

create table if not exists battles (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  prompt_id text not null default '',
  prompt text not null,
  status text not null default 'inviting',
  created_at timestamptz not null default now()
);

alter table battles drop constraint if exists battles_status_check;
alter table battles
  add constraint battles_status_check
  check (status in ('inviting', 'ready', 'cancelled', 'finished'));

create table if not exists battle_slots (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references battles(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  student_name text not null,
  side text not null,
  status text not null default 'pending',
  hero_id text,
  unique (battle_id, side),
  unique (battle_id, student_id)
);

alter table battle_slots drop constraint if exists battle_slots_side_check;
alter table battle_slots
  add constraint battle_slots_side_check
  check (side in ('left', 'right'));

alter table battle_slots drop constraint if exists battle_slots_status_check;
alter table battle_slots
  add constraint battle_slots_status_check
  check (status in ('pending', 'accepted', 'declined'));

create index if not exists battle_slots_student_idx on battle_slots (student_id);
create index if not exists battles_teacher_idx on battles (teacher_id, created_at desc);

alter table battles add column if not exists live jsonb not null default '{}'::jsonb;

alter table battles enable row level security;
alter table battle_slots enable row level security;
alter table battles replica identity full;
alter table battle_slots replica identity full;

drop policy if exists "Teachers read own battles" on battles;
create policy "Teachers read own battles"
  on battles for select to authenticated
  using (teacher_id = auth.uid());

drop policy if exists "Teachers read own battle slots" on battle_slots;
create policy "Teachers read own battle slots"
  on battle_slots for select to authenticated
  using (
    exists (
      select 1 from battles b
      where b.id = battle_id and b.teacher_id = auth.uid()
    )
  );

create or replace function battle_payload(p_battle_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'id', b.id,
    'status', b.status,
    'prompt', b.prompt,
    'prompt_id', b.prompt_id,
    'class_id', b.class_id,
    'live', coalesce(b.live, '{}'::jsonb),
    'slots', coalesce((
      select json_agg(json_build_object(
        'side', s.side,
        'student_id', s.student_id,
        'student_name', s.student_name,
        'status', s.status,
        'hero_id', s.hero_id
      ) order by s.side)
      from battle_slots s
      where s.battle_id = b.id
    ), '[]'::json)
  )
  from battles b
  where b.id = p_battle_id;
$$;

create or replace function create_battle(
  p_class_id uuid,
  p_left_student_id uuid,
  p_right_student_id uuid,
  p_prompt_id text,
  p_prompt text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  left_name text;
  right_name text;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  if p_left_student_id is null or p_right_student_id is null or p_left_student_id = p_right_student_id then
    return json_build_object('ok', false, 'error', 'students');
  end if;
  if length(trim(coalesce(p_prompt, ''))) = 0 then
    return json_build_object('ok', false, 'error', 'prompt');
  end if;
  if not exists (
    select 1 from classes
    where id = p_class_id and teacher_id = auth.uid()
  ) then
    return json_build_object('ok', false, 'error', 'class');
  end if;

  select coalesce(nullif(trim(name), ''), username)
    into left_name
  from students
  where id = p_left_student_id and class_id = p_class_id;
  select coalesce(nullif(trim(name), ''), username)
    into right_name
  from students
  where id = p_right_student_id and class_id = p_class_id;

  if left_name is null or right_name is null then
    return json_build_object('ok', false, 'error', 'students');
  end if;

  update battles
     set status = 'cancelled'
   where teacher_id = auth.uid()
     and status in ('inviting', 'ready');

  insert into battles (teacher_id, class_id, prompt_id, prompt, status)
  values (auth.uid(), p_class_id, coalesce(p_prompt_id, ''), trim(p_prompt), 'inviting')
  returning id into new_id;

  insert into battle_slots (battle_id, student_id, student_name, side)
  values
    (new_id, p_left_student_id, left_name, 'left'),
    (new_id, p_right_student_id, right_name, 'right');

  return json_build_object('ok', true, 'battle', battle_payload(new_id));
end;
$$;

create or replace function get_teacher_battle(p_battle_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_battle_id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  if not exists (
    select 1 from battles where id = p_battle_id and teacher_id = auth.uid()
  ) then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  return json_build_object('ok', true, 'battle', battle_payload(p_battle_id));
end;
$$;

create or replace function cancel_battle(p_battle_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  update battles
     set status = 'cancelled'
   where id = p_battle_id
     and teacher_id = auth.uid()
     and status in ('inviting', 'ready');
  return json_build_object('ok', true);
end;
$$;

create or replace function finish_battle(p_battle_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  update battles
     set status = 'finished'
   where id = p_battle_id
     and teacher_id = auth.uid()
     and status in ('inviting', 'ready');
  return json_build_object('ok', true);
end;
$$;

create or replace function get_student_battle(p_student_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  b battles%rowtype;
  mine battle_slots%rowtype;
  opp_name text;
begin
  if p_student_id is null then
    return json_build_object('ok', true, 'battle', null);
  end if;

  select btl.*
    into b
  from battles btl
  join battle_slots sl on sl.battle_id = btl.id
  where sl.student_id = p_student_id
    and btl.status in ('inviting', 'ready')
    and sl.status <> 'declined'
  order by btl.created_at desc
  limit 1;

  if not found then
    return json_build_object('ok', true, 'battle', null);
  end if;

  select * into mine from battle_slots where battle_id = b.id and student_id = p_student_id;
  select student_name into opp_name
  from battle_slots
  where battle_id = b.id and student_id <> p_student_id
  limit 1;

  return json_build_object(
    'ok', true,
    'slot_status', mine.status,
    'side', mine.side,
    'hero_id', mine.hero_id,
    'opponent_name', coalesce(opp_name, ''),
    'battle', battle_payload(b.id)
  );
end;
$$;

create or replace function set_battle_live(p_battle_id uuid, p_live jsonb)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_battle_id is null then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  update battles
     set prompt = case
           when coalesce(p_live, '{}'::jsonb) ? 'lessons'
            and jsonb_typeof(p_live->'lessons') = 'array'
            and jsonb_array_length(p_live->'lessons') > 0
             then coalesce(
               p_live->'lessons'->greatest(
                 0,
                 least(coalesce((p_live->>'lesson')::int, 0), jsonb_array_length(p_live->'lessons') - 1)
               )->>'prompt',
               prompt
             )
           else prompt
         end,
         prompt_id = case
           when coalesce(p_live, '{}'::jsonb) ? 'lessons'
            and jsonb_typeof(p_live->'lessons') = 'array'
            and jsonb_array_length(p_live->'lessons') > 0
             then coalesce(
               p_live->'lessons'->greatest(
                 0,
                 least(coalesce((p_live->>'lesson')::int, 0), jsonb_array_length(p_live->'lessons') - 1)
               )->>'id',
               prompt_id
             )
           else prompt_id
         end,
         live = case
       when coalesce(p_live, '{}'::jsonb) ? 'racers' then
         coalesce(live, '{}'::jsonb) || jsonb_build_object(
           'phase', coalesce(p_live->>'phase', live->>'phase', 'lobby'),
           'countdownStartedAt', coalesce(p_live->'countdownStartedAt', live->'countdownStartedAt', 'null'::jsonb),
           'lesson', coalesce(p_live->'lesson', live->'lesson', '0'::jsonb),
           'lessons', coalesce(p_live->'lessons', live->'lessons', '[]'::jsonb),
           'racers', p_live->'racers'
         )
       else
         coalesce(live, '{}'::jsonb) || jsonb_build_object(
           'phase', coalesce(p_live->>'phase', live->>'phase', 'lobby'),
           'countdownStartedAt', coalesce(p_live->'countdownStartedAt', live->'countdownStartedAt', 'null'::jsonb)
         )
     end
   where id = p_battle_id
     and teacher_id = auth.uid()
     and status in ('inviting', 'ready');
  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  return json_build_object('ok', true);
end;
$$;

drop function if exists push_battle_progress(uuid, uuid, int, int, bigint, bigint, boolean, boolean);

create or replace function push_battle_progress(
  p_student_id uuid,
  p_battle_id uuid,
  p_index int,
  p_errors int,
  p_started_at bigint,
  p_ms bigint,
  p_done boolean,
  p_forfeit boolean,
  p_lesson int default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  b battles%rowtype;
  mine battle_slots%rowtype;
  slot int;
  racers jsonb;
  typed int;
  misses int;
  started bigint;
  ms bigint;
  finished boolean;
  result jsonb;
  mine_json jsonb;
  other_json jsonb;
  both_done boolean;
  left_row jsonb;
  right_row jsonb;
  left_hp numeric;
  right_hp numeric;
  loser_slot int;
  old_errors int;
  lesson_count int;
  next_i int;
  next_prompt text;
  next_id text;
  new_live jsonb;
  i int;
begin
  if p_student_id is null or p_battle_id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  select * into b from battles where id = p_battle_id and status = 'ready';
  if b.id is null or coalesce(b.live->>'phase', '') <> 'type' then
    return get_student_battle(p_student_id);
  end if;

  select * into mine
  from battle_slots
  where battle_id = p_battle_id and student_id = p_student_id and status = 'accepted';
  if mine.id is null then
    return json_build_object('ok', false, 'error', 'slot');
  end if;

  if p_lesson is not null and p_lesson is distinct from coalesce((b.live->>'lesson')::int, 0) then
    return get_student_battle(p_student_id);
  end if;

  slot := case when mine.side = 'right' then 1 else 0 end;
  racers := coalesce(b.live->'racers', '[]'::jsonb);
  if jsonb_typeof(racers) <> 'array' or jsonb_array_length(racers) < 2 then
    racers := '[
      {"index":0,"errors":0,"startedAt":null,"result":null},
      {"index":0,"errors":0,"startedAt":null,"result":null}
    ]'::jsonb;
  end if;

  if jsonb_typeof(racers->slot->'result') = 'object' then
    return get_student_battle(p_student_id);
  end if;

  typed := greatest(0, least(coalesce(p_index, 0), length(b.prompt)));
  misses := greatest(0, coalesce(p_errors, 0));
  started := coalesce(p_started_at, nullif(racers->slot->>'startedAt', '')::bigint);
  finished := coalesce(p_forfeit, false) or coalesce(p_done, false);

  if finished then
    ms := greatest(1, coalesce(p_ms, 1));
    result := jsonb_build_object(
      'ms', ms,
      'errors', misses,
      'index', typed,
      'done', (not coalesce(p_forfeit, false)) and length(b.prompt) > 0 and typed >= length(b.prompt),
      'forfeit', coalesce(p_forfeit, false),
      'wpm', case
        when (not coalesce(p_forfeit, false)) and typed >= length(b.prompt) and length(b.prompt) > 0
          then round((length(b.prompt) / 5.0) / (greatest(ms, 1000) / 60000.0))
        else 0
      end
    );
  else
    result := 'null'::jsonb;
  end if;

  mine_json := jsonb_build_object(
    'index', typed,
    'errors', misses,
    'bank', coalesce(nullif(racers->slot->>'bank', '')::int, 0),
    'startedAt', to_jsonb(started),
    'result', result
  );

  update battles
     set live = jsonb_set(
       case
         when jsonb_typeof(coalesce(live->'racers', '[]'::jsonb)) = 'array'
          and jsonb_array_length(coalesce(live->'racers', '[]'::jsonb)) >= 2
           then coalesce(live, '{}'::jsonb)
         else jsonb_set(
           coalesce(live, '{}'::jsonb),
           '{racers}',
           '[
             {"index":0,"errors":0,"startedAt":null,"result":null},
             {"index":0,"errors":0,"startedAt":null,"result":null}
           ]'::jsonb,
           true
         )
       end,
       array['racers', slot::text],
       mine_json,
       true
     )
   where id = p_battle_id
   returning live into racers;

  other_json := coalesce(racers->'racers'->((1 - slot)::text), '{}'::jsonb);
  both_done := jsonb_typeof(mine_json->'result') = 'object' and jsonb_typeof(other_json->'result') = 'object';
  left_row := coalesce(racers->'racers'->0, '{}'::jsonb);
  right_row := coalesce(racers->'racers'->1, '{}'::jsonb);
  left_hp := 100
    - coalesce(nullif(left_row->>'errors', '')::numeric, 0) * 8
    + (coalesce(nullif(left_row->>'bank', '')::numeric, 0) + coalesce(nullif(left_row->>'index', '')::numeric, 0)) * 0.55
    - (coalesce(nullif(right_row->>'bank', '')::numeric, 0) + coalesce(nullif(right_row->>'index', '')::numeric, 0)) * 0.22;
  right_hp := 100
    - coalesce(nullif(right_row->>'errors', '')::numeric, 0) * 8
    + (coalesce(nullif(right_row->>'bank', '')::numeric, 0) + coalesce(nullif(right_row->>'index', '')::numeric, 0)) * 0.55
    - (coalesce(nullif(left_row->>'bank', '')::numeric, 0) + coalesce(nullif(left_row->>'index', '')::numeric, 0)) * 0.22;

  if left_hp <= 0 or right_hp <= 0 then
    old_errors := coalesce(nullif(b.live#>>array['racers', slot::text, 'errors'], '')::int, 0);
    if left_hp <= 0 and right_hp > 0 then
      loser_slot := 0;
    elsif right_hp <= 0 and left_hp > 0 then
      loser_slot := 1;
    elsif misses > old_errors then
      loser_slot := slot;
    else
      loser_slot := 1 - slot;
    end if;

    update battles
       set live = jsonb_set(
         jsonb_set(
           jsonb_set(live, '{phase}', '"result"'::jsonb, true),
           '{racers,0,result}',
           case
             when 0 <> loser_slot and jsonb_typeof(live#>'{racers,0,result}') = 'object'
               then live#>'{racers,0,result}'
             else jsonb_build_object(
               'ms', 1,
               'errors', coalesce(nullif(live#>>'{racers,0,errors}', '')::int, 0),
               'index', coalesce(nullif(live#>>'{racers,0,index}', '')::int, 0),
               'done', false,
               'forfeit', false,
               'wpm', 0,
               'ko', 0 = loser_slot
             )
           end,
           true
         ),
         '{racers,1,result}',
         case
           when 1 <> loser_slot and jsonb_typeof(live#>'{racers,1,result}') = 'object'
             then live#>'{racers,1,result}'
           else jsonb_build_object(
             'ms', 1,
             'errors', coalesce(nullif(live#>>'{racers,1,errors}', '')::int, 0),
             'index', coalesce(nullif(live#>>'{racers,1,index}', '')::int, 0),
             'done', false,
             'forfeit', false,
             'wpm', 0,
             'ko', 1 = loser_slot
           )
         end,
         true
       )
     where id = p_battle_id;
  elsif length(coalesce(b.prompt, '')) > 0
    and coalesce(nullif(left_row->>'index', '')::int, 0) >= length(b.prompt)
    and coalesce(nullif(right_row->>'index', '')::int, 0) >= length(b.prompt)
    and jsonb_typeof(racers->'lessons') = 'array'
    and jsonb_array_length(racers->'lessons') > 0
  then
    lesson_count := jsonb_array_length(racers->'lessons');
    next_i := coalesce((racers->>'lesson')::int, 0) + 1;
    if next_i >= lesson_count or next_i < 0 then
      next_i := 0;
    end if;
    next_prompt := racers->'lessons'->next_i->>'prompt';
    next_id := coalesce(racers->'lessons'->next_i->>'id', '');
    if length(coalesce(next_prompt, '')) > 0 then
      new_live := racers;
      for i in 0..1 loop
        new_live := jsonb_set(
          new_live,
          array['racers', i::text, 'bank'],
          to_jsonb(
            coalesce((new_live#>>array['racers', i::text, 'bank'])::int, 0)
            + coalesce((new_live#>>array['racers', i::text, 'index'])::int, 0)
          ),
          true
        );
        new_live := jsonb_set(new_live, array['racers', i::text, 'index'], '0'::jsonb, true);
        new_live := jsonb_set(new_live, array['racers', i::text, 'result'], 'null'::jsonb, true);
      end loop;
      new_live := jsonb_set(new_live, '{lesson}', to_jsonb(next_i), true);
      new_live := jsonb_set(new_live, '{phase}', '"type"'::jsonb, true);
      update battles
         set prompt = next_prompt,
             prompt_id = next_id,
             live = new_live
       where id = p_battle_id;
    end if;
  elsif both_done then
    update battles
       set live = jsonb_set(live, '{phase}', '"result"'::jsonb, true)
     where id = p_battle_id;
  end if;

  return get_student_battle(p_student_id);
end;
$$;

create or replace function respond_battle(
  p_student_id uuid,
  p_battle_id uuid,
  p_accept boolean,
  p_hero_id text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  b battles%rowtype;
  ready_count int;
begin
  if p_student_id is null or p_battle_id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  select * into b from battles where id = p_battle_id;
  if b.id is null or b.status <> 'inviting' then
    return json_build_object('ok', false, 'error', 'closed');
  end if;
  if not exists (
    select 1 from battle_slots
    where battle_id = p_battle_id and student_id = p_student_id and status = 'pending'
  ) then
    return json_build_object('ok', false, 'error', 'slot');
  end if;

  if coalesce(p_accept, false) then
    if coalesce(p_hero_id, '') not in ('archer', 'heavy', 'shaman', 'shadow') then
      return json_build_object('ok', false, 'error', 'hero');
    end if;
    update battle_slots
       set status = 'accepted',
           hero_id = p_hero_id
     where battle_id = p_battle_id and student_id = p_student_id;
  else
    update battle_slots
       set status = 'declined',
           hero_id = null
     where battle_id = p_battle_id and student_id = p_student_id;
  end if;

  select count(*) into ready_count
  from battle_slots
  where battle_id = p_battle_id and status = 'accepted' and hero_id is not null;

  if ready_count = 2 then
    update battles set status = 'ready' where id = p_battle_id and status = 'inviting';
  end if;

  return get_student_battle(p_student_id);
end;
$$;

revoke all on function battle_payload(uuid) from public;
revoke all on function create_battle(uuid, uuid, uuid, text, text) from public;
revoke all on function get_teacher_battle(uuid) from public;
revoke all on function cancel_battle(uuid) from public;
revoke all on function finish_battle(uuid) from public;
revoke all on function get_student_battle(uuid) from public;
revoke all on function respond_battle(uuid, uuid, boolean, text) from public;
revoke all on function set_battle_live(uuid, jsonb) from public;
revoke all on function push_battle_progress(uuid, uuid, int, int, bigint, bigint, boolean, boolean, int) from public;

grant execute on function create_battle(uuid, uuid, uuid, text, text) to authenticated;
grant execute on function get_teacher_battle(uuid) to authenticated;
grant execute on function cancel_battle(uuid) to authenticated;
grant execute on function finish_battle(uuid) to authenticated;
grant execute on function get_student_battle(uuid) to anon, authenticated;
grant execute on function respond_battle(uuid, uuid, boolean, text) to anon, authenticated;
grant execute on function set_battle_live(uuid, jsonb) to authenticated;
grant execute on function push_battle_progress(uuid, uuid, int, int, bigint, bigint, boolean, boolean, int) to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'battles'
    ) then
      execute 'alter publication supabase_realtime add table battles';
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'battle_slots'
    ) then
      execute 'alter publication supabase_realtime add table battle_slots';
    end if;
  end if;
end $$;

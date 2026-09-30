-- =====================================================================
--  0002 — challenge-wide tasks, end-of-challenge lock, push notifications
--  Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run
--  (Safe to run on a database that already has 0001 applied.)
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. CREATE A CHALLENGE WITH ITS TASKS IN ONE GO
--     The task list is applied to EVERY day of the challenge.
-- ---------------------------------------------------------------------
create or replace function public.create_challenge_with_tasks(
  p_title       text,
  p_description text,
  p_day_count   int,
  p_start_date  date,
  p_is_public   boolean,
  p_tasks       text[] default '{}'
)
returns public.challenges
language plpgsql security definer set search_path = public as $$
declare
  c       public.challenges;
  cleaned text[];
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a challenge';
  end if;

  -- Trim, drop blanks, clip to the tasks.title limit, keep the given order.
  select array_agg(x order by ord)
    into cleaned
  from (
    select left(btrim(t), 140) as x, ord
    from unnest(coalesce(p_tasks, '{}')) with ordinality as u(t, ord)
    where btrim(t) <> ''
  ) s;

  if coalesce(array_length(cleaned, 1), 0) > 20 then
    raise exception 'A challenge can start with at most 20 daily tasks';
  end if;

  insert into public.challenges (creator_id, title, description, day_count, start_date, is_public)
  values (
    auth.uid(),
    btrim(p_title),
    nullif(btrim(coalesce(p_description, '')), ''),
    p_day_count,
    p_start_date,
    coalesce(p_is_public, true)
  )
  returning * into c;

  -- challenges_create_days (from 0001) has now generated one row per day,
  -- so every day can be given the same starting checklist.
  if coalesce(array_length(cleaned, 1), 0) > 0 then
    insert into public.tasks (challenge_id, day_id, title, position)
    select c.id, d.id, t.title, (t.ord - 1)::int
    from public.challenge_days d
    cross join unnest(cleaned) with ordinality as t(title, ord)
    where d.challenge_id = c.id;
  end if;

  return c;
end $$;

grant execute on function public.create_challenge_with_tasks(text, text, int, date, boolean, text[]) to authenticated;


-- ---------------------------------------------------------------------
--  2. LOCK A CHALLENGE ONCE IT IS OVER
--     Past days stay editable WHILE the challenge runs; once the last day
--     has passed nothing that affects the result may change again.
-- ---------------------------------------------------------------------
create or replace function public.reject_if_challenge_ended()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cid  uuid;
  ends date;
begin
  if tg_op = 'DELETE' then cid := old.challenge_id; else cid := new.challenge_id; end if;

  select end_date into ends from public.challenges where id = cid;

  if ends is not null and ends < current_date then
    raise exception 'This challenge finished on %. It can no longer be changed.',
      to_char(ends, 'DD Mon YYYY')
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;

drop trigger if exists tasks_locked_after_end on public.tasks;
create trigger tasks_locked_after_end
  before insert or update or delete on public.tasks
  for each row execute function public.reject_if_challenge_ended();

drop trigger if exists completions_locked_after_end on public.task_completions;
create trigger completions_locked_after_end
  before insert or update or delete on public.task_completions
  for each row execute function public.reject_if_challenge_ended();

drop trigger if exists focus_locked_after_end on public.focus_sessions;
create trigger focus_locked_after_end
  before insert or update or delete on public.focus_sessions
  for each row execute function public.reject_if_challenge_ended();

-- The challenge row itself also freezes, except for the lifecycle status —
-- finalize_due_challenges() still needs to flip 'active' to 'completed'.
create or replace function public.reject_challenge_edit_after_end()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.end_date < current_date then
    if (new.title, new.description, new.day_count, new.start_date,
        new.is_public, new.creator_id, new.opponent_id)
       is distinct from
       (old.title, old.description, old.day_count, old.start_date,
        old.is_public, old.creator_id, old.opponent_id)
    then
      raise exception 'This challenge has finished and can no longer be edited.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists challenge_locked_after_end on public.challenges;
create trigger challenge_locked_after_end
  before update on public.challenges
  for each row execute function public.reject_challenge_edit_after_end();


-- ---------------------------------------------------------------------
--  3. PUSH TOKENS
--     One row per device. A user may be signed in on several.
-- ---------------------------------------------------------------------
create table if not exists public.push_tokens (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  token      text not null,
  platform   text,
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

drop policy if exists push_tokens_select_own on public.push_tokens;
create policy push_tokens_select_own on public.push_tokens
  for select to authenticated using (user_id = auth.uid());

drop policy if exists push_tokens_insert_own on public.push_tokens;
create policy push_tokens_insert_own on public.push_tokens
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists push_tokens_update_own on public.push_tokens;
create policy push_tokens_update_own on public.push_tokens
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists push_tokens_delete_own on public.push_tokens;
create policy push_tokens_delete_own on public.push_tokens
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.push_tokens to authenticated;


-- ---------------------------------------------------------------------
--  4. SENDING A PUSH
--     Uses pg_net to call Expo's push service. Every call is wrapped so a
--     notification problem can never roll back the action that caused it.
-- ---------------------------------------------------------------------
create extension if not exists pg_net;

create or replace function public.send_expo_push(
  p_tokens text[],
  p_title  text,
  p_body   text,
  p_data   jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer set search_path = public as $$
declare msgs jsonb;
begin
  if p_tokens is null or coalesce(array_length(p_tokens, 1), 0) = 0 then
    return;
  end if;

  select jsonb_agg(jsonb_build_object(
           'to',        t,
           'title',     p_title,
           'body',      p_body,
           'data',      p_data,
           'sound',     'default',
           'priority',  'high',
           'channelId', 'challenge-events'
         ))
    into msgs
  from (select distinct unnest(p_tokens) as t) u
  where t like 'Expo%';

  if msgs is null then return; end if;

  begin
    perform net.http_post(
      url     := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'Accept', 'application/json'),
      body    := msgs
    );
  exception when others then
    -- pg_net missing, network down, Expo unreachable: swallow it. A failed
    -- notification must never stop someone ticking a task.
    null;
  end;
end $$;


-- ---------------------------------------------------------------------
--  5. NOTIFY THE OPPONENT WHEN A TASK IS TICKED
-- ---------------------------------------------------------------------
create or replace function public.notify_task_completed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c          public.challenges;
  rival      uuid;
  actor      text;
  v_day_id   uuid;
  v_day_no   int;
  v_title    text;
  v_done     int;
  v_total    int;
  v_tokens   text[];
begin
  select * into c from public.challenges where id = new.challenge_id;
  if not found or c.opponent_id is null then return new; end if;

  rival := case when new.user_id = c.creator_id then c.opponent_id else c.creator_id end;
  if rival is null or rival = new.user_id then return new; end if;

  select array_agg(pt.token) into v_tokens
  from public.push_tokens pt where pt.user_id = rival;
  if v_tokens is null then return new; end if;

  select coalesce(nullif(btrim(p.display_name), ''), p.username) into actor
  from public.profiles p where p.id = new.user_id;

  select t.day_id, t.title into v_day_id, v_title
  from public.tasks t where t.id = new.task_id;

  select d.day_number into v_day_no
  from public.challenge_days d where d.id = v_day_id;

  select count(*)::int into v_total from public.tasks where day_id = v_day_id;

  select count(*)::int into v_done
  from public.tasks t
  join public.task_completions tc on tc.task_id = t.id and tc.user_id = new.user_id
  where t.day_id = v_day_id;

  perform public.send_expo_push(
    v_tokens,
    case when v_done >= v_total and v_total > 0
         then actor || ' finished day ' || v_day_no || ' 🟩'
         else actor || ' ticked a task' end,
    c.title || ' · ' || v_title || '  (' || v_done || '/' || v_total || ')',
    jsonb_build_object(
      'type',        case when v_done >= v_total and v_total > 0 then 'day_completed' else 'task_completed' end,
      'challengeId', c.id::text,
      'dayNumber',   v_day_no
    )
  );

  return new;
exception when others then
  -- Same guarantee as above: never break the tick itself.
  return new;
end $$;

drop trigger if exists task_completed_notify on public.task_completions;
create trigger task_completed_notify
  after insert on public.task_completions
  for each row execute function public.notify_task_completed();

grant execute on function public.send_expo_push(text[], text, text, jsonb) to authenticated;

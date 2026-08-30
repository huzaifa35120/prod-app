-- =====================================================================
--  CHALLENGE APP — initial schema
--  Paste this whole file into: Supabase Dashboard -> SQL Editor -> Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
--  ENUMS
-- ---------------------------------------------------------------------
do $$ begin
  create type public.friend_status as enum ('pending','accepted','declined');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.challenge_status as enum ('open','active','completed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.join_request_status as enum ('pending','accepted','declined');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
--  PROFILES
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique not null,
  display_name text,
  avatar_url   text,
  bio          text,
  created_at   timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

-- Auto-create a profile whenever a new auth user signs up.
-- Picks a unique username from metadata, falling back to the email local-part.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base      text;
  candidate text;
  n         int := 0;
begin
  base := lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1), ''));
  base := regexp_replace(base, '[^a-z0-9_]', '', 'g');
  if length(base) < 3 then
    base := 'user' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  base := substr(base, 1, 16);

  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := base || n::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (new.id, candidate, coalesce(nullif(new.raw_user_meta_data->>'display_name',''), candidate));

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
--  FRIENDSHIPS
-- ---------------------------------------------------------------------
create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status       public.friend_status not null default 'pending',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint no_self_friend check (requester_id <> addressee_id)
);

-- One relationship per pair, regardless of who asked first.
create unique index if not exists friendships_pair_uniq
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create index if not exists friendships_addressee_idx on public.friendships (addressee_id, status);
create index if not exists friendships_requester_idx on public.friendships (requester_id, status);

-- ---------------------------------------------------------------------
--  CHALLENGES  (strictly 1-v-1: creator + opponent)
-- ---------------------------------------------------------------------
create table if not exists public.challenges (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references public.profiles(id) on delete cascade,
  opponent_id uuid references public.profiles(id) on delete set null,
  title       text not null check (char_length(title) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  day_count   int  not null check (day_count between 1 and 365),
  start_date  date not null,
  end_date    date generated always as (start_date + (day_count - 1)) stored,
  status      public.challenge_status not null default 'open',
  is_public   boolean not null default true,
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  created_at  timestamptz not null default now(),
  constraint opponent_not_creator check (opponent_id is null or opponent_id <> creator_id)
);

create index if not exists challenges_creator_idx  on public.challenges (creator_id);
create index if not exists challenges_opponent_idx on public.challenges (opponent_id);
create index if not exists challenges_open_idx     on public.challenges (status, is_public, created_at desc);

-- ---------------------------------------------------------------------
--  CHALLENGE DAYS  (one row per day, generated on insert)
-- ---------------------------------------------------------------------
create table if not exists public.challenge_days (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  day_number   int  not null check (day_number >= 1),
  day_date     date not null,
  unique (challenge_id, day_number)
);

create index if not exists challenge_days_challenge_idx on public.challenge_days (challenge_id, day_number);

create or replace function public.create_challenge_days()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.challenge_days (challenge_id, day_number, day_date)
  select new.id, gs, new.start_date + (gs - 1)
  from generate_series(1, new.day_count) as gs;
  return new;
end $$;

drop trigger if exists challenges_create_days on public.challenges;
create trigger challenges_create_days
  after insert on public.challenges
  for each row execute function public.create_challenge_days();

-- ---------------------------------------------------------------------
--  TASKS  (checkboxes for a day — only the challenge creator may edit)
-- ---------------------------------------------------------------------
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  day_id       uuid not null references public.challenge_days(id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 140),
  position     int  not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists tasks_day_idx on public.tasks (day_id, position);

-- ---------------------------------------------------------------------
--  TASK COMPLETIONS  (each participant ticks their own copy)
-- ---------------------------------------------------------------------
create table if not exists public.task_completions (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (task_id, user_id)
);

create index if not exists task_completions_challenge_idx on public.task_completions (challenge_id, user_id);

-- ---------------------------------------------------------------------
--  FOCUS SESSIONS  (productivity timer entries)
-- ---------------------------------------------------------------------
create table if not exists public.focus_sessions (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  day_id       uuid not null references public.challenge_days(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  seconds      int  not null check (seconds > 0 and seconds <= 86400),
  note         text check (note is null or char_length(note) <= 200),
  created_at   timestamptz not null default now()
);

create index if not exists focus_sessions_challenge_idx on public.focus_sessions (challenge_id, user_id);
create index if not exists focus_sessions_day_idx       on public.focus_sessions (day_id, user_id);

-- ---------------------------------------------------------------------
--  JOIN REQUESTS  (ask to join a public challenge)
-- ---------------------------------------------------------------------
create table if not exists public.challenge_join_requests (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  status       public.join_request_status not null default 'pending',
  message      text check (message is null or char_length(message) <= 200),
  created_at   timestamptz not null default now(),
  unique (challenge_id, user_id)
);

create index if not exists join_requests_challenge_idx on public.challenge_join_requests (challenge_id, status);
create index if not exists join_requests_user_idx      on public.challenge_join_requests (user_id, status);

-- =====================================================================
--  HELPER FUNCTIONS  (security definer so RLS policies don't recurse)
-- =====================================================================
create or replace function public.is_challenge_participant(cid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.challenges c
    where c.id = cid and (c.creator_id = uid or c.opponent_id = uid)
  );
$$;

create or replace function public.is_challenge_creator(cid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.challenges c where c.id = cid and c.creator_id = uid);
$$;

create or replace function public.challenge_is_visible(cid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.challenges c
    where c.id = cid and (c.is_public or c.creator_id = uid or c.opponent_id = uid)
  );
$$;

-- =====================================================================
--  ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles               enable row level security;
alter table public.friendships            enable row level security;
alter table public.challenges             enable row level security;
alter table public.challenge_days         enable row level security;
alter table public.tasks                  enable row level security;
alter table public.task_completions       enable row level security;
alter table public.focus_sessions         enable row level security;
alter table public.challenge_join_requests enable row level security;

-- ---- profiles -------------------------------------------------------
-- Everyone signed in can read profiles (needed to search for friends).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());

-- ---- friendships ----------------------------------------------------
drop policy if exists friendships_select on public.friendships;
create policy friendships_select on public.friendships
  for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists friendships_insert on public.friendships;
create policy friendships_insert on public.friendships
  for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');

-- The addressee accepts/declines; the requester may re-send after a decline.
drop policy if exists friendships_update on public.friendships;
create policy friendships_update on public.friendships
  for update to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid())
  with check (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships
  for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- ---- challenges -----------------------------------------------------
drop policy if exists challenges_select on public.challenges;
create policy challenges_select on public.challenges
  for select to authenticated
  using (is_public or creator_id = auth.uid() or opponent_id = auth.uid());

drop policy if exists challenges_insert on public.challenges;
create policy challenges_insert on public.challenges
  for insert to authenticated with check (creator_id = auth.uid());

-- Only the creator edits the challenge itself. Joining happens through
-- the join_challenge* RPCs below, never through a direct UPDATE.
drop policy if exists challenges_update on public.challenges;
create policy challenges_update on public.challenges
  for update to authenticated
  using (creator_id = auth.uid()) with check (creator_id = auth.uid());

drop policy if exists challenges_delete on public.challenges;
create policy challenges_delete on public.challenges
  for delete to authenticated using (creator_id = auth.uid());

-- ---- challenge_days -------------------------------------------------
drop policy if exists challenge_days_select on public.challenge_days;
create policy challenge_days_select on public.challenge_days
  for select to authenticated using (public.challenge_is_visible(challenge_id, auth.uid()));
-- No insert/update/delete policies: days exist only via the trigger.

-- ---- tasks ----------------------------------------------------------
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated using (public.challenge_is_visible(challenge_id, auth.uid()));

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated with check (public.is_challenge_creator(challenge_id, auth.uid()));

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (public.is_challenge_creator(challenge_id, auth.uid()))
  with check (public.is_challenge_creator(challenge_id, auth.uid()));

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete to authenticated using (public.is_challenge_creator(challenge_id, auth.uid()));

-- ---- task_completions -----------------------------------------------
-- Both players can see each other's ticks; you may only tick your own.
drop policy if exists task_completions_select on public.task_completions;
create policy task_completions_select on public.task_completions
  for select to authenticated using (public.is_challenge_participant(challenge_id, auth.uid()));

drop policy if exists task_completions_insert on public.task_completions;
create policy task_completions_insert on public.task_completions
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_challenge_participant(challenge_id, auth.uid()));

drop policy if exists task_completions_delete on public.task_completions;
create policy task_completions_delete on public.task_completions
  for delete to authenticated using (user_id = auth.uid());

-- ---- focus_sessions -------------------------------------------------
drop policy if exists focus_sessions_select on public.focus_sessions;
create policy focus_sessions_select on public.focus_sessions
  for select to authenticated using (public.is_challenge_participant(challenge_id, auth.uid()));

drop policy if exists focus_sessions_insert on public.focus_sessions;
create policy focus_sessions_insert on public.focus_sessions
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_challenge_participant(challenge_id, auth.uid()));

drop policy if exists focus_sessions_delete on public.focus_sessions;
create policy focus_sessions_delete on public.focus_sessions
  for delete to authenticated using (user_id = auth.uid());

-- ---- challenge_join_requests ----------------------------------------
drop policy if exists join_requests_select on public.challenge_join_requests;
create policy join_requests_select on public.challenge_join_requests
  for select to authenticated
  using (user_id = auth.uid() or public.is_challenge_creator(challenge_id, auth.uid()));

drop policy if exists join_requests_insert on public.challenge_join_requests;
create policy join_requests_insert on public.challenge_join_requests
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists join_requests_delete on public.challenge_join_requests;
create policy join_requests_delete on public.challenge_join_requests
  for delete to authenticated using (user_id = auth.uid());
-- Accept/decline goes through respond_to_join_request().

-- =====================================================================
--  GRANTS
--  RLS above is what restricts *rows*; these grants let the authenticated
--  role reach the tables at all. Supabase sets these by default, but being
--  explicit keeps this script self-contained.
-- =====================================================================
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  public.profiles, public.friendships, public.challenges, public.tasks,
  public.task_completions, public.focus_sessions, public.challenge_join_requests
  to authenticated;

-- Days are created by a trigger only, so read-only is enough.
grant select on public.challenge_days to authenticated;

-- =====================================================================
--  STATS VIEWS
--  security_invoker = on  ->  the caller's RLS still applies.
-- =====================================================================
create or replace view public.challenge_participants
with (security_invoker = on) as
  select c.id as challenge_id, c.creator_id  as user_id, 'creator'::text  as role from public.challenges c
  union all
  select c.id, c.opponent_id, 'opponent' from public.challenges c where c.opponent_id is not null;

-- Per user, per day: how many tasks are ticked and how much focus time was logged.
-- is_complete drives the green day colouring in the app.
create or replace view public.challenge_day_progress
with (security_invoker = on) as
select
  d.challenge_id,
  d.id          as day_id,
  d.day_number,
  d.day_date,
  p.user_id,
  count(t.id)::int  as total_tasks,
  count(tc.id)::int as completed_tasks,
  (count(t.id) > 0 and count(t.id) = count(tc.id)) as is_complete,
  coalesce(fs.seconds, 0)::int as focus_seconds
from public.challenge_days d
join public.challenge_participants p on p.challenge_id = d.challenge_id
left join public.tasks t             on t.day_id = d.id
left join public.task_completions tc on tc.task_id = t.id and tc.user_id = p.user_id
left join lateral (
  select sum(f.seconds)::int as seconds
  from public.focus_sessions f
  where f.day_id = d.id and f.user_id = p.user_id
) fs on true
where public.is_challenge_participant(d.challenge_id, auth.uid())
group by d.challenge_id, d.id, d.day_number, d.day_date, p.user_id, fs.seconds;

-- Head-to-head totals for a challenge. Ordering by total_seconds gives the winner.
create or replace view public.challenge_leaderboard
with (security_invoker = on) as
select
  p.challenge_id,
  p.user_id,
  p.role,
  coalesce(sum(dp.focus_seconds), 0)::bigint      as total_seconds,
  count(*) filter (where dp.is_complete)::int     as days_complete,
  coalesce(sum(dp.completed_tasks), 0)::int       as tasks_done,
  coalesce(sum(dp.total_tasks), 0)::int           as tasks_total
from public.challenge_participants p
left join public.challenge_day_progress dp
  on dp.challenge_id = p.challenge_id and dp.user_id = p.user_id
where public.is_challenge_participant(p.challenge_id, auth.uid())
group by p.challenge_id, p.user_id, p.role;

grant select on public.challenge_participants  to authenticated;
grant select on public.challenge_day_progress  to authenticated;
grant select on public.challenge_leaderboard   to authenticated;

-- =====================================================================
--  RPCs
-- =====================================================================

-- Join an open challenge as the second player. Locks the row so two people
-- racing for the same slot can't both win it.
create or replace function public.join_challenge(p_challenge_id uuid)
returns public.challenges language plpgsql security definer set search_path = public as $$
declare c public.challenges;
begin
  select * into c from public.challenges where id = p_challenge_id for update;
  if not found then raise exception 'Challenge not found' using errcode = 'P0002'; end if;
  if c.creator_id = auth.uid() then raise exception 'You created this challenge'; end if;
  if c.opponent_id is not null then raise exception 'This challenge already has an opponent'; end if;
  if c.status <> 'open' then raise exception 'This challenge is no longer open'; end if;

  update public.challenges
     set opponent_id = auth.uid(), status = 'active'
   where id = p_challenge_id
  returning * into c;

  update public.challenge_join_requests
     set status = (case when user_id = auth.uid() then 'accepted' else 'declined' end)::public.join_request_status
   where challenge_id = p_challenge_id and status = 'pending';

  return c;
end $$;

-- Same thing, but from an invite link's code.
create or replace function public.join_challenge_by_code(p_code text)
returns public.challenges language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  select id into target from public.challenges where invite_code = lower(trim(p_code));
  if target is null then raise exception 'That invite link is not valid' using errcode = 'P0002'; end if;
  return public.join_challenge(target);
end $$;

-- Ask the creator of a public challenge for a slot.
create or replace function public.request_to_join(p_challenge_id uuid, p_message text default null)
returns public.challenge_join_requests language plpgsql security definer set search_path = public as $$
declare c public.challenges; r public.challenge_join_requests;
begin
  select * into c from public.challenges where id = p_challenge_id;
  if not found then raise exception 'Challenge not found' using errcode = 'P0002'; end if;
  if c.creator_id = auth.uid() then raise exception 'You created this challenge'; end if;
  if c.opponent_id is not null then raise exception 'This challenge already has an opponent'; end if;
  if c.status <> 'open' then raise exception 'This challenge is no longer open'; end if;

  insert into public.challenge_join_requests (challenge_id, user_id, message)
  values (p_challenge_id, auth.uid(), nullif(trim(coalesce(p_message, '')), ''))
  on conflict (challenge_id, user_id)
  do update set status = 'pending', message = excluded.message, created_at = now()
  returning * into r;

  return r;
end $$;

-- Creator accepts or declines. Accepting fills the opponent slot and
-- auto-declines everyone else waiting.
create or replace function public.respond_to_join_request(p_request_id uuid, p_accept boolean)
returns public.challenges language plpgsql security definer set search_path = public as $$
declare r public.challenge_join_requests; c public.challenges;
begin
  select * into r from public.challenge_join_requests where id = p_request_id;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;

  select * into c from public.challenges where id = r.challenge_id for update;
  if c.creator_id <> auth.uid() then raise exception 'That is not your challenge'; end if;

  if not p_accept then
    update public.challenge_join_requests set status = 'declined' where id = r.id;
    return c;
  end if;

  if c.opponent_id is not null then raise exception 'This challenge already has an opponent'; end if;

  update public.challenges
     set opponent_id = r.user_id, status = 'active'
   where id = c.id
  returning * into c;

  update public.challenge_join_requests
     set status = (case when id = r.id then 'accepted' else 'declined' end)::public.join_request_status
   where challenge_id = c.id and status = 'pending';

  return c;
end $$;

-- Friend search that also reports the current relationship with each result.
create or replace function public.search_users(q text)
returns table (
  id uuid, username text, display_name text, avatar_url text,
  friend_status text, friendship_id uuid, i_requested boolean
) language sql stable security definer set search_path = public as $$
  select
    p.id, p.username, p.display_name, p.avatar_url,
    f.status::text, f.id, (f.requester_id = auth.uid())
  from public.profiles p
  left join public.friendships f
    on least(f.requester_id, f.addressee_id)    = least(p.id, auth.uid())
   and greatest(f.requester_id, f.addressee_id) = greatest(p.id, auth.uid())
  where p.id <> auth.uid()
    and (p.username ilike trim(q) || '%' or p.display_name ilike '%' || trim(q) || '%')
  order by p.username
  limit 25;
$$;

-- Flip the caller's finished challenges to 'completed'. Cheap to call on load.
create or replace function public.finalize_due_challenges()
returns int language sql volatile security definer set search_path = public as $$
  with upd as (
    update public.challenges
       set status = 'completed'
     where status = 'active'
       and end_date < current_date
       and (creator_id = auth.uid() or opponent_id = auth.uid())
    returning 1
  ) select coalesce(count(*), 0)::int from upd;
$$;

grant execute on function public.join_challenge(uuid)                     to authenticated;
grant execute on function public.join_challenge_by_code(text)             to authenticated;
grant execute on function public.request_to_join(uuid, text)              to authenticated;
grant execute on function public.respond_to_join_request(uuid, boolean)   to authenticated;
grant execute on function public.search_users(text)                       to authenticated;
grant execute on function public.finalize_due_challenges()                to authenticated;

-- Lets an invitee see what they are being invited to *before* joining.
-- Needed because RLS hides private challenges from non-participants.
create or replace function public.preview_invite(p_code text)
returns table (
  challenge_id uuid, title text, description text, day_count int,
  start_date date, end_date date, status public.challenge_status,
  creator_username text, creator_display_name text, has_opponent boolean,
  i_am_creator boolean
) language sql stable security definer set search_path = public as $$
  select c.id, c.title, c.description, c.day_count, c.start_date, c.end_date, c.status,
         p.username, p.display_name, (c.opponent_id is not null), (c.creator_id = auth.uid())
  from public.challenges c
  join public.profiles p on p.id = c.creator_id
  where c.invite_code = lower(trim(p_code));
$$;

grant execute on function public.preview_invite(text) to authenticated;

-- =====================================================================
--  REALTIME  (live opponent progress + timer updates)
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'challenges','tasks','task_completions','focus_sessions',
    'challenge_join_requests','friendships'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

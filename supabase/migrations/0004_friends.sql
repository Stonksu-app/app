-- Friends, and the nudge you can send one.
--
-- Mutual by design: a ping puts a notification on someone's phone, so it needs
-- consent from both sides. A follow model would let a stranger follow you
-- purely to be able to poke you.
--
-- Safe to re-run.

create table if not exists public.friendships (
  requester_id uuid not null references auth.users on delete cascade,
  addressee_id uuid not null references auth.users on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,

  primary key (requester_id, addressee_id),
  constraint friendships_not_self check (requester_id <> addressee_id)
);

create index if not exists friendships_addressee_idx
  on public.friendships (addressee_id, status);

comment on table public.friendships is
  'One row per relationship, in the direction it was asked. A pair never has two rows: a reciprocal request accepts the existing one instead.';

create table if not exists public.pings (
  id bigint generated always as identity primary key,
  from_id uuid not null references auth.users on delete cascade,
  to_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  seen_at timestamptz,

  constraint pings_not_self check (from_id <> to_id)
);

create index if not exists pings_inbox_idx on public.pings (to_id, created_at desc);

-- ------------------------------------------------------- row level security

alter table public.friendships enable row level security;
alter table public.pings enable row level security;

-- Reading only. Every change goes through the functions below, so the rules
-- about who may accept what live in one place instead of being spread across
-- policies the client could try to work around.
drop policy if exists "see your own friendships" on public.friendships;
create policy "see your own friendships"
  on public.friendships for select to authenticated
  using (auth.uid() in (requester_id, addressee_id));

drop policy if exists "see pings sent to you" on public.pings;
create policy "see pings sent to you"
  on public.pings for select to authenticated
  using (auth.uid() = to_id);

drop policy if exists "mark your own pings seen" on public.pings;
create policy "mark your own pings seen"
  on public.pings for update to authenticated
  using (auth.uid() = to_id)
  with check (auth.uid() = to_id);

-- ------------------------------------------------------------------ helpers

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b)
        or (f.requester_id = b and f.addressee_id = a))
  );
$$;

-- --------------------------------------------------------------- requesting

-- Returns a short code the client turns into a sentence, rather than raising:
-- "you already asked them" is an ordinary outcome, not an exception.
create or replace function public.friend_request(nickname text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
  me uuid := auth.uid();
begin
  if me is null then return 'not_signed_in'; end if;

  select id into target
  from public.profiles
  where lower(btrim(name)) = lower(btrim(nickname));

  if target is null then return 'not_found'; end if;
  if target = me then return 'thats_you'; end if;

  if public.are_friends(me, target) then return 'already_friends'; end if;

  -- They asked first. Treating a reciprocal request as an acceptance is what
  -- keeps a pair to a single row, and it is what the player meant anyway.
  update public.friendships
  set status = 'accepted', responded_at = now()
  where requester_id = target and addressee_id = me and status = 'pending';
  if found then return 'accepted'; end if;

  if exists (select 1 from public.friendships
             where requester_id = me and addressee_id = target) then
    return 'already_sent';
  end if;

  insert into public.friendships (requester_id, addressee_id) values (me, target);
  return 'sent';
end;
$$;

create or replace function public.friend_respond(other uuid, accept boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then return false; end if;

  if accept then
    -- Only the person who was asked can accept, which is the whole point.
    update public.friendships
    set status = 'accepted', responded_at = now()
    where requester_id = other and addressee_id = me and status = 'pending';
    return found;
  end if;

  delete from public.friendships
  where requester_id = other and addressee_id = me and status = 'pending';
  return found;
end;
$$;

-- Works in both directions, so it covers unfriending and cancelling a request
-- you sent without the client having to know which it is.
create or replace function public.friend_remove(other uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then return false; end if;
  delete from public.friendships
  where (requester_id = me and addressee_id = other)
     or (requester_id = other and addressee_id = me);
  return found;
end;
$$;

-- ------------------------------------------------------------------ reading

-- Row level security stops a player reading anyone else's profile, and it
-- should. This hands back only what a friends list needs — nickname, bull,
-- streak, xp — and only for people you are actually connected to.
create or replace function public.friend_list()
returns table (
  id uuid,
  name text,
  avatar jsonb,
  streak integer,
  xp integer,
  relation text,
  since timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select p.id, p.name, p.avatar, p.streak, p.xp,
         case
           when f.status = 'accepted' then 'friend'
           when f.requester_id = auth.uid() then 'outgoing'
           else 'incoming'
         end as relation,
         coalesce(f.responded_at, f.created_at) as since
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where auth.uid() in (f.requester_id, f.addressee_id)
  order by f.status desc, p.streak desc, p.name;
$$;

-- ------------------------------------------------------------------- pings

/** One per friend per hour. A nudge that can be spammed is harassment. */
create or replace function public.friend_ping(other uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then return 'not_signed_in'; end if;
  if not public.are_friends(me, other) then return 'not_friends'; end if;

  if exists (
    select 1 from public.pings
    where from_id = me and to_id = other and created_at > now() - interval '1 hour'
  ) then
    return 'too_soon';
  end if;

  insert into public.pings (from_id, to_id) values (me, other);
  return 'sent';
end;
$$;

-- The sender's nickname lives behind row level security, so the inbox has to
-- be assembled here rather than joined client-side.
create or replace function public.ping_inbox()
returns table (id bigint, from_name text, from_avatar jsonb, created_at timestamptz)
language sql
security definer
set search_path = ''
stable
as $$
  select g.id, p.name, p.avatar, g.created_at
  from public.pings g
  join public.profiles p on p.id = g.from_id
  where g.to_id = auth.uid() and g.seen_at is null
  order by g.created_at desc
  limit 20;
$$;

create or replace function public.ping_mark_seen()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  touched integer;
begin
  update public.pings set seen_at = now()
  where to_id = auth.uid() and seen_at is null;
  get diagnostics touched = row_count;
  return touched;
end;
$$;

-- ------------------------------------------------------------------ grants

revoke all on function public.are_friends(uuid, uuid) from public;
revoke all on function public.friend_request(text) from public;
revoke all on function public.friend_respond(uuid, boolean) from public;
revoke all on function public.friend_remove(uuid) from public;
revoke all on function public.friend_list() from public;
revoke all on function public.friend_ping(uuid) from public;
revoke all on function public.ping_inbox() from public;
revoke all on function public.ping_mark_seen() from public;

grant execute on function public.friend_request(text) to authenticated;
grant execute on function public.friend_respond(uuid, boolean) to authenticated;
grant execute on function public.friend_remove(uuid) to authenticated;
grant execute on function public.friend_list() to authenticated;
grant execute on function public.friend_ping(uuid) to authenticated;
grant execute on function public.ping_inbox() to authenticated;
grant execute on function public.ping_mark_seen() to authenticated;
-- are_friends stays internal: it is a building block for the others, not an
-- endpoint for probing whether two strangers know each other.

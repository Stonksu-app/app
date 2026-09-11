-- The days a player was active, as their own device saw them.
--
-- Lessons only ever left a UTC timestamp in `attempts`, so anything rebuilding
-- a calendar from outside that device — a friend's profile, served from here —
-- had to infer the day from the clock, and a session after midnight local
-- landed on the square before. The streak has always counted local days, so
-- the number and the calendar could describe different things, which is
-- exactly how a streak stops being believed.
--
-- Repasos already stored their day in review_dates; this is the same idea for
-- every kind of activity, and it supersedes deriving days from timestamps.

alter table public.profiles
  add column if not exists active_dates date[] not null default '{}';

comment on column public.profiles.active_dates is
  'Local days with activity, as recorded by the client. Authoritative for calendars; attempts keep the timestamps.';

-- friend_profile prefers it, falling back to the old derivation for profiles
-- written before this column existed.
drop function if exists public.friend_profile(uuid);

create or replace function public.friend_profile(other uuid)
returns table (
  id uuid,
  name text,
  avatar jsonb,
  streak integer,
  xp integer,
  plan text,
  lessons integer,
  accuracy numeric,
  member_since timestamptz,
  last_active date,
  active_days date[],
  frozen_days date[]
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    p.id,
    p.name,
    p.avatar,
    p.streak,
    p.xp,
    p.plan,
    coalesce(array_length(p.completed_lesson_ids, 1), 0) as lessons,
    case
      when coalesce(sum(a.total_questions), 0) = 0 then null
      else round(100.0 * sum(a.correct_count) / sum(a.total_questions))
    end as accuracy,
    p.created_at as member_since,
    p.last_active_date as last_active,
    (
      select coalesce(array_agg(distinct d), '{}')
      from (
        -- What the owner's device recorded, in their own local days.
        select unnest(p.active_dates)::date as d
        union
        select unnest(p.review_dates)::date
        union
        -- Only for rows that predate active_dates: without this an older
        -- profile would show an empty calendar under a real streak.
        select (a2.completed_at at time zone 'UTC')::date
        from public.attempts a2
        where a2.user_id = p.id
          and coalesce(array_length(p.active_dates, 1), 0) = 0
          and a2.completed_at >= now() - interval '60 days'
      ) days
      where d >= (now() - interval '60 days')::date
    ) as active_days,
    (
      select coalesce(array_agg(fd::date), '{}')
      from unnest(p.frozen_dates) fd
      where fd::date >= (now() - interval '60 days')::date
    ) as frozen_days
  from public.profiles p
  left join public.attempts a on a.user_id = p.id
  where p.id = other
    and public.are_friends(auth.uid(), other)
  group by p.id;
$$;

revoke all on function public.friend_profile(uuid) from public;
grant execute on function public.friend_profile(uuid) to authenticated;

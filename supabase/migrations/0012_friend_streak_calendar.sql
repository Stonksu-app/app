-- A friend's streak calendar.
--
-- The profile already shows their streak as a number; this is the same claim
-- with its evidence — which days they practised and which a protector covered.
-- Same door as the rest of friend_profile: accepted friends only, aggregated
-- here rather than handing over the attempt rows themselves.
--
-- Dates only, and only the last 60 days. A date is the granularity the
-- calendar draws anyway; the timestamps behind them would say what time
-- somebody studies, which is a different and more revealing thing, and no
-- screen asks for it.
--
-- The dates are UTC, where the client keys the calendar by the viewer's local
-- day. For a friend in another timezone that can shift a late-night session by
-- one square. Converting would need their timezone, which the app doesn't
-- store and has no reason to start storing for a decoration.

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
    -- Lessons and repasos both count, exactly as they do for your own
    -- calendar: a day spent revising is a day practised.
    (
      select coalesce(array_agg(distinct d), '{}')
      from (
        select (a2.completed_at at time zone 'UTC')::date as d
        from public.attempts a2
        where a2.user_id = p.id
          and a2.completed_at >= now() - interval '60 days'
        union
        select unnest(p.review_dates)::date
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

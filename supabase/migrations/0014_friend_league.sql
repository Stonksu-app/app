-- A friend's league, in the list and on their profile.
--
-- Both functions gain one column, which means dropping them: Postgres won't
-- let "create or replace" change a return type. Same doors as before —
-- friend_list answers about your own friendships, friend_profile about
-- accepted friends only.
--
-- league_rank is the index into LEAGUE_RANKS on the client (0..5), written
-- only by the weekly reset and join_league_if_needed(), never by a client.

drop function if exists public.friend_list();

create or replace function public.friend_list()
returns table (
  id uuid,
  name text,
  avatar jsonb,
  streak integer,
  xp integer,
  plan text,
  league_rank integer,
  relation text,
  since timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select p.id, p.name, p.avatar, p.streak, p.xp, p.plan, p.league_rank,
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

revoke all on function public.friend_list() from public;
grant execute on function public.friend_list() to authenticated;

drop function if exists public.friend_profile(uuid);

create or replace function public.friend_profile(other uuid)
returns table (
  id uuid,
  name text,
  avatar jsonb,
  streak integer,
  xp integer,
  plan text,
  league_rank integer,
  weekly_xp integer,
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
    p.league_rank,
    -- The number their league actually ranks on, so their card can say where
    -- they are this week rather than only which league they're in.
    p.weekly_xp,
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
        select unnest(p.active_dates)::date as d
        union
        select unnest(p.review_dates)::date
        union
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

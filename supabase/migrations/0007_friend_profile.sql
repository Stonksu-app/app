-- A friend's profile, and only a friend's.
--
-- The friends list already carries a name, an avatar, a streak and XP — enough
-- for a row, not enough for a reason to add anybody. This adds the rest of
-- what one player can see about another: how accurate they are, how much
-- they've finished, since when they've been playing, and whether they're on a
-- paid plan.
--
-- security definer because the numbers come from tables the caller can't read
-- (another player's attempts are theirs), and the function is the only door:
-- it answers for accepted friends and for nobody else. Accuracy is aggregated
-- here rather than shipping the attempt rows, so "what my friend answered" is
-- never on the wire — only how often they got it right.

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
  last_active date
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
    -- Null rather than zero when they've never answered anything: "0% de
    -- aciertos" and "hasn't started" are different things to show.
    case
      when coalesce(sum(a.total_questions), 0) = 0 then null
      else round(100.0 * sum(a.correct_count) / sum(a.total_questions))
    end as accuracy,
    p.created_at as member_since,
    p.last_active_date as last_active
  from public.profiles p
  left join public.attempts a on a.user_id = p.id
  where p.id = other
    and public.are_friends(auth.uid(), other)
  group by p.id;
$$;

revoke all on function public.friend_profile(uuid) from public;
grant execute on function public.friend_profile(uuid) to authenticated;

-- The list gains the plan too, so the badge shows without opening anything.
-- Dropped rather than replaced: adding a column to the return type of an
-- existing function is not something "create or replace" is allowed to do.
drop function if exists public.friend_list();

create or replace function public.friend_list()
returns table (
  id uuid,
  name text,
  avatar jsonb,
  streak integer,
  xp integer,
  plan text,
  relation text,
  since timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select p.id, p.name, p.avatar, p.streak, p.xp, p.plan,
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

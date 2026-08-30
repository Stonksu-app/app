-- Weekly leagues: small tables of registered players, ranked on the XP they
-- earn during the week — not their lifetime total — the way Duolingo's
-- leagues work. Top 4 of a table promote a rank, the last relegates, the
-- middle stays put. Tables cap at 10 and reset every Monday.
--
-- league_rank, league_table_id and league_week_start are server-owned: only
-- run_weekly_league_reset() and join_league_if_needed() ever write them. The
-- client only ever reads them back (see src/lib/cloud.ts, which leaves them
-- out of what it pushes) so a stale local copy can never overwrite this
-- week's real placement. weekly_xp is the one of the four the client does
-- write, the same way it already writes xp.
--
-- Anonymous accounts don't compete: a table full of installs that vanish on
-- reinstall isn't a league, and it gives registering one more reason to be
-- worth doing.

alter table public.profiles
  add column if not exists league_rank integer not null default 0
    check (league_rank between 0 and 5);

alter table public.profiles
  add column if not exists weekly_xp integer not null default 0;

alter table public.profiles
  add column if not exists league_table_id uuid;

alter table public.profiles
  add column if not exists league_week_start date;

comment on column public.profiles.league_rank is
  '0 Beginner .. 5 Market Master. Only run_weekly_league_reset() changes this.';
comment on column public.profiles.weekly_xp is
  'XP earned since league_week_start — what this week''s table is ranked on, not lifetime xp.';
comment on column public.profiles.league_table_id is
  'Which group of (up to) 10 same-league players this account is competing against this week.';

create index if not exists profiles_league_table_idx on public.profiles (league_table_id);

-- --------------------------------------------------------------- joining a table

/**
 * Seats the caller for the current week if they aren't already: joins
 * whichever of their league's tables still has room, or starts a new one.
 * Self-service and safe under RLS despite being security definer, because it
 * only ever touches the caller's own row — called from the league screen on
 * every visit, so a newly registered player or one whose table was cleared
 * by the weekly reset gets seated the moment they look.
 *
 * Anonymous accounts are turned away rather than seated: a table with a
 * member who can vanish on reinstall isn't a fair one for the nine people
 * competing against them.
 */
create or replace function public.join_league_if_needed()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  my_rank integer;
  today date := current_date;
  candidate uuid;
begin
  if not exists (select 1 from auth.users where id = me and is_anonymous = false) then
    return;
  end if;

  select league_rank into my_rank from public.profiles where id = me;
  if my_rank is null then
    return;
  end if;

  if exists (
    select 1 from public.profiles
    where id = me and league_table_id is not null and league_week_start = today
  ) then
    return;
  end if;

  select league_table_id into candidate
  from public.profiles
  where league_rank = my_rank and league_week_start = today and league_table_id is not null
  group by league_table_id
  having count(*) < 10
  limit 1;

  if candidate is null then
    candidate := gen_random_uuid();
  end if;

  update public.profiles
  set league_table_id = candidate, league_week_start = today
  where id = me;
end;
$$;

revoke all on function public.join_league_if_needed() from public;
grant execute on function public.join_league_if_needed() to authenticated;

-- --------------------------------------------------------------- reading a table

/**
 * The caller's own table, ranked by this week's XP. Security definer for the
 * same reason friend_profile is: the numbers come from other players' rows,
 * and this function is the only door — it answers with exactly the caller's
 * own table_id and nothing wider.
 */
create or replace function public.league_leaderboard()
returns table (
  id uuid,
  name text,
  avatar jsonb,
  weekly_xp integer,
  is_self boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select p.id, p.name, p.avatar, p.weekly_xp, p.id = auth.uid() as is_self
  from public.profiles p
  where p.league_table_id is not null
    and p.league_table_id = (select league_table_id from public.profiles where id = auth.uid())
  order by p.weekly_xp desc, p.id;
$$;

revoke all on function public.league_leaderboard() from public;
grant execute on function public.league_leaderboard() to authenticated;

-- --------------------------------------------------------------- the weekly reset

/**
 * Settles every table's week: top 4 promote, last relegates, both only when
 * the table is actually big enough for that to mean something (a league that
 * never filled up doesn't promote its entire membership or demote its only
 * player). Then clears every table and every week's XP, so the next visit to
 * join_league_if_needed() seats everyone fresh. Scheduled below; also safe to
 * run by hand from the SQL editor.
 */
create or replace function public.run_weekly_league_reset()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with ranked as (
    select
      p.id,
      row_number() over (partition by p.league_table_id order by p.weekly_xp desc, p.id) as pos,
      count(*) over (partition by p.league_table_id) as table_size
    from public.profiles p
    where p.league_table_id is not null
  )
  update public.profiles p
  set league_rank = case
    when r.pos <= 4 and r.table_size > 4 then least(5, p.league_rank + 1)
    when r.pos = r.table_size and r.table_size > 1 then greatest(0, p.league_rank - 1)
    else p.league_rank
  end
  from ranked r
  where p.id = r.id;

  update public.profiles
  set weekly_xp = 0,
      league_table_id = null,
      league_week_start = null
  where league_table_id is not null;
end;
$$;

revoke all on function public.run_weekly_league_reset() from public;

-- Only pg_cron (below) calls this; nothing client-facing should be able to
-- force everyone's week to end early.

create extension if not exists pg_cron;

select cron.schedule(
  'weekly-league-reset',
  '0 0 * * 1', -- every Monday, 00:00 UTC
  $$select public.run_weekly_league_reset();$$
);

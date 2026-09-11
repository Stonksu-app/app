-- TEMPORARY, for testing while there are fewer registered players than a
-- table holds: everyone shares one fixed table regardless of league_rank,
-- instead of being grouped into separate tables of up to 10 within their own
-- rank. Revert once there are enough registered players for per-rank tables
-- to mean something, by restoring 0009's version of join_league_if_needed()
-- (group by league_rank, cap each table at 10, generate a fresh table id per
-- group instead of reusing the fixed one below).
--
-- run_weekly_league_reset() and league_leaderboard() are untouched — both
-- already work off whatever league_table_id a player has, so nothing about
-- how a table got formed matters to either of them.

create or replace function public.join_league_if_needed()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  today date := current_date;
  shared_table constant uuid := '00000000-0000-0000-0000-000000000001';
begin
  if not exists (select 1 from auth.users where id = me and is_anonymous = false) then
    return;
  end if;

  update public.profiles
  set league_table_id = shared_table, league_week_start = today
  where id = me
    and (league_table_id is distinct from shared_table or league_week_start is distinct from today);
end;
$$;

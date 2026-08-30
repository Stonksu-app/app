-- One-time seed for the same testing period as 0010: puts every already-
-- registered player on the shared table right now, instead of waiting for
-- each of them to open the league screen once (which is what actually seats
-- someone — see join_league_if_needed()). Safe to run more than once.

update public.profiles p
set league_table_id = '00000000-0000-0000-0000-000000000001',
    league_week_start = current_date
from auth.users u
where u.id = p.id
  and u.is_anonymous = false
  and (p.league_table_id is distinct from '00000000-0000-0000-0000-000000000001'
    or p.league_week_start is distinct from current_date);

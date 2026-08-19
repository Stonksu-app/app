-- Mirrors account status from auth.users into public.profiles.
--
-- auth.users is not readable from the client, so without this there is no way
-- to answer "is this account registered?" from a query, and the Table Editor
-- shows a wall of profiles with no clue which are real people and which are
-- anonymous sessions that will disappear with someone's browser cache.
--
-- Safe to run on top of 0001, and safe to re-run.

alter table public.profiles
  add column if not exists email text,
  add column if not exists is_anonymous boolean not null default true,
  add column if not exists registered_at timestamptz;

comment on column public.profiles.email is 'Confirmed address, copied from auth.users. Null while unverified.';
comment on column public.profiles.is_anonymous is 'False once an identity is linked and verified.';
comment on column public.profiles.registered_at is 'When the account stopped being anonymous.';

-- Only ever written by the trigger below. The client can still technically
-- update these columns through its own policy, but they are cosmetic mirrors:
-- authorisation reads auth.uid(), never these.
create or replace function public.sync_account_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, is_anonymous, registered_at)
  values (
    new.id,
    new.email,
    coalesce(new.is_anonymous, false),
    case when coalesce(new.is_anonymous, false) then null else now() end
  )
  on conflict (id) do update set
    email = excluded.email,
    is_anonymous = excluded.is_anonymous,
    -- Set once, on the transition out of anonymous, and never moved after.
    registered_at = coalesce(public.profiles.registered_at, excluded.registered_at);
  return new;
end;
$$;

-- Fires on signup and again when the email is confirmed or an identity is
-- linked, which is the moment is_anonymous flips.
drop trigger if exists on_auth_user_status_changed on auth.users;
create trigger on_auth_user_status_changed
  after insert or update of email, is_anonymous on auth.users
  for each row execute function public.sync_account_status();

-- 0001 created profiles on insert only; this supersedes it.
drop trigger if exists on_auth_user_created on auth.users;

-- Backfill anyone who signed in before this migration ran.
update public.profiles p
set email = u.email,
    is_anonymous = coalesce(u.is_anonymous, false),
    registered_at = case
      when coalesce(u.is_anonymous, false) then null
      else coalesce(p.registered_at, u.created_at)
    end
from auth.users u
where u.id = p.id;

-- Handy in the dashboard: how the player base splits.
--
-- security_invoker means the view runs under the caller's permissions, so RLS
-- still applies: from the SQL Editor you get the real totals, while a player
-- querying it through the anon key would only ever count their own row. A view
-- without it would happily leak the whole user count to the client.
create or replace view public.account_summary
with (security_invoker = true) as
select
  count(*) filter (where not is_anonymous) as registered,
  count(*) filter (where is_anonymous) as anonymous,
  count(*) as total
from public.profiles;

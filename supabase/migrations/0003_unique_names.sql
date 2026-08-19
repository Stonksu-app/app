-- One "mordekai", one "pollo": nicknames are unique across the whole app.
--
-- Safe to run on top of 0002, and safe to re-run.

-- Existing collisions would stop the index being built, so they get a numeric
-- suffix first. On a fresh project this matches nothing.
with ranked as (
  select id,
         name,
         row_number() over (partition by lower(btrim(name)) order by created_at, id) as n
  from public.profiles
  where btrim(name) <> ''
)
update public.profiles p
set name = p.name || r.n::text
from ranked r
where r.id = p.id and r.n > 1;

-- Case-insensitive: "Pollo" and "pollo" are the same nickname to a human, so
-- letting both exist would defeat the point. Partial, because every account
-- starts with an empty name and those must not collide with each other.
create unique index if not exists profiles_name_unique_ci
  on public.profiles (lower(btrim(name)))
  where btrim(name) <> '';

-- Deliberately loose. The real 3-20 rule is a UX decision and lives in the
-- client; this is only here so the column can never hold something absurd.
alter table public.profiles
  drop constraint if exists profiles_name_sane;
alter table public.profiles
  add constraint profiles_name_sane check (char_length(name) <= 24);

-- ------------------------------------------------------------- availability

-- Row level security stops a player reading anyone else's profile, which also
-- stops them checking whether a nickname is free. This is the narrowest way
-- around that: security definer so it can see every row, but it returns a
-- single boolean, so nothing leaks beyond "taken or not" — which is inherent to
-- having unique names at all.
--
-- The caller's own row is excluded, so re-submitting the name you already have
-- reads as available rather than as a collision with yourself.
create or replace function public.name_available(candidate text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select not exists (
    select 1
    from public.profiles
    where lower(btrim(name)) = lower(btrim(candidate))
      and id is distinct from auth.uid()
  );
$$;

revoke all on function public.name_available(text) from public;
grant execute on function public.name_available(text) to authenticated;

comment on function public.name_available(text) is
  'True when the nickname is free. Excludes the caller, so your own name is always available to you.';

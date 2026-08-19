-- Stonksu: initial schema.
--
-- Run this once per Supabase project (dev and production separately) from the
-- SQL Editor. It is written to be re-runnable: every object is created with
-- "if not exists" or dropped first, so a second run is a no-op rather than an
-- error.
--
-- Shape: one profile row per player holding the whole game state, plus an
-- append-only attempts table for lesson history. Everything is per-user and
-- nothing is shared, so row level security is a simple "you only see your own".

-- ---------------------------------------------------------------- profiles

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,

  name text not null default '',
  onboarded boolean not null default false,
  onboarding_answers jsonb not null default '{"experience": null, "goal": null}'::jsonb,

  xp integer not null default 0,
  coins integer not null default 0,
  hearts integer not null default 5,
  last_heart_lost_at timestamptz,

  streak integer not null default 0,
  last_active_date date,
  streak_protectors integer not null default 0,

  completed_lesson_ids text[] not null default '{}',
  unlocked_badge_ids text[] not null default '{}',
  seen_intro_node_ids text[] not null default '{}',
  opened_chest_ids text[] not null default '{}',
  claimed_mission_ids text[] not null default '{}',
  unlocked_accessories text[] not null default '{ninguno}',
  pending_mistakes text[] not null default '{}',

  node_stage_progress jsonb not null default '{}'::jsonb,
  avatar jsonb not null default '{
    "body": "#C6FF34", "mask": "#171717", "horns": "curvos",
    "eyes": "arco", "accessory": "ninguno", "accessoryColor": "#FFC93C"
  }'::jsonb,

  virtual_balance numeric(14, 2) not null default 10000,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- The client is the only writer, and a client can be tampered with. These
  -- keep a bad build (or a curious user with the anon key) from persisting a
  -- state the game can never produce.
  constraint profiles_xp_non_negative check (xp >= 0),
  constraint profiles_coins_non_negative check (coins >= 0),
  constraint profiles_hearts_in_range check (hearts between 0 and 5),
  constraint profiles_streak_non_negative check (streak >= 0),
  constraint profiles_protectors_in_range check (streak_protectors between 0 and 2)
);

comment on table public.profiles is 'One row per player: the whole game state except lesson history.';
comment on column public.profiles.node_stage_progress is 'nodeId -> stages cleared. Platinum is stages = stagesForDifficulty(node).';

-- testMode is deliberately absent: it is a local debugging switch, not
-- progress, and syncing it would unlock the tree on every device you log into.

-- ---------------------------------------------------------------- attempts

create table if not exists public.attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,

  lesson_id text not null,
  node_id text not null,
  completed_at timestamptz not null,
  xp_earned integer not null default 0,
  correct_count integer not null default 0,
  total_questions integer not null default 0,

  created_at timestamptz not null default now(),

  constraint attempts_counts_sane check (
    correct_count >= 0
    and total_questions >= 0
    and correct_count <= total_questions
  ),

  -- Makes the push idempotent: re-syncing the same local history updates the
  -- existing rows instead of duplicating a player's streak calendar.
  constraint attempts_unique_per_completion unique (user_id, lesson_id, completed_at)
);

create index if not exists attempts_user_completed_idx
  on public.attempts (user_id, completed_at desc);

comment on table public.attempts is 'Append-only lesson history. Drives the streak calendar and achievements.';

-- ------------------------------------------------------- row level security

alter table public.profiles enable row level security;
alter table public.attempts enable row level security;

drop policy if exists "profiles are self-service" on public.profiles;
create policy "profiles are self-service"
  on public.profiles for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "attempts are self-service" on public.attempts;
create policy "attempts are self-service"
  on public.attempts for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -------------------------------------------------------------- automation

-- updated_at has to be maintained server-side; a client that sets it itself can
-- lie, and last-write-wins depends on it being honest.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- A profile row appears the moment an account is created, including the
-- anonymous accounts the app signs in with, so the client never has to handle
-- "logged in but has no row".
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

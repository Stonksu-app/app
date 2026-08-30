-- The highest league this account has already been paid for.
--
-- Promotion is decided by the weekly reset; the coins are paid by the client
-- the first time it sees the new rank. That has to be remembered somewhere
-- both devices can see, or opening the app on a phone and a laptop after a
-- promotion collects the reward twice.
--
-- Client-owned, unlike league_rank itself: the server decides which league
-- you're in, the client records which one it has already celebrated.

alter table public.profiles
  add column if not exists league_rewarded_rank integer not null default 0;

comment on column public.profiles.league_rewarded_rank is
  'Highest league_rank already rewarded on this account. Written by the client after paying a promotion.';

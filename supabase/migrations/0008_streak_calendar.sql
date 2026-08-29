-- The calendar days behind a running streak: which ones a protector actually
-- covered, and which were a repaso instead of a lesson.
--
-- Both used to live only on the device. That kept a laptop from showing a
-- frozen day for a gap it never lived through, but it meant a reinstall — or
-- just testing a new build — recovered the streak number and the protector
-- count from here fine, and silently lost which exact days were behind them:
-- the calendar went blank where it should have shown blue, with nothing
-- wrong-looking enough to explain why. The streak and its protectors are
-- real progress; the days that earned them are the same kind of fact and
-- belong next to them.
--
-- last_streak_loss stays device-local on purpose: it is an explanation of
-- what happened on this device, not a fact about the account, and syncing it
-- would mean narrating a phone's lost streak on a laptop that never saw it.

alter table public.profiles
  add column if not exists frozen_dates date[] not null default '{}';

alter table public.profiles
  add column if not exists review_dates date[] not null default '{}';

comment on column public.profiles.frozen_dates is
  'Calendar dates a streak protector covered. Drives the "congelado" days on the streak calendar.';
comment on column public.profiles.review_dates is
  'Calendar dates kept active by a repaso rather than a lesson. Drives the streak calendar the same way attempts do.';

-- Subscriptions: which plan an account is on, and since when.
--
-- Stored on the profile rather than derived from a payments table because the
-- app only ever asks one question — what may this player do right now — and a
-- receipt history answers that far more slowly. When real billing arrives, its
-- webhook writes here; everything reading it keeps working unchanged.
--
-- Constrained rather than free text: a typo'd plan name would silently read as
-- "not ultra" and quietly take away what somebody paid for.

alter table public.profiles
  add column if not exists plan text not null default 'free'
    check (plan in ('free', 'premium', 'ultra'));

alter table public.profiles
  add column if not exists plan_started_at timestamptz;

comment on column public.profiles.plan is
  'free | premium | ultra. Premium removes ads; ultra also lifts hearts and the practice limit.';
comment on column public.profiles.plan_started_at is
  'When the current plan began. Null on free.';

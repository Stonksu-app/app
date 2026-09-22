-- Mirror of database/supabase/migrations/20260922125730_billing.sql.
-- toca datos: retira planes de simulación sin una suscripción verificada.
-- Stripe is the authority for paid plans. The client may still sync learning
-- progress, but cannot change plan or plan_started_at through its profile row.
create or replace function public.protect_billing_plan()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin') then
    if tg_op = 'INSERT' then
      new.plan := 'free';
      new.plan_started_at := null;
    else
      new.plan := old.plan;
      new.plan_started_at := old.plan_started_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_billing_plan on public.profiles;
create trigger profiles_protect_billing_plan
  before insert or update on public.profiles
  for each row execute function public.protect_billing_plan();

create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users on delete cascade,
  stripe_customer_id text not null unique
);

alter table public.billing_customers enable row level security;
revoke all on public.billing_customers from anon, authenticated;
grant all on public.billing_customers to service_role;

create table if not exists public.billing_subscriptions (
  user_id uuid primary key references auth.users on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  plan text not null check (plan in ('premium', 'ultra')),
  status text not null,
  current_period_end timestamptz,
  last_event_created bigint not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists billing_subscriptions_customer_idx
  on public.billing_subscriptions (stripe_customer_id);

alter table public.billing_subscriptions enable row level security;
drop policy if exists "players read own billing status" on public.billing_subscriptions;
create policy "players read own billing status"
  on public.billing_subscriptions for select to authenticated
  using (auth.uid() = user_id);

revoke all on public.billing_subscriptions from anon, authenticated;
grant select on public.billing_subscriptions to authenticated;
grant all on public.billing_subscriptions to service_role;

-- Service role alone may update billing rows. An authenticated player can
-- neither fake a subscription nor write another player's entitlement.
-- Existing paid plans came from the old preview and have no verified receipt.
update public.profiles p set plan = 'free', plan_started_at = null
where p.plan <> 'free'
  and not exists (select 1 from public.billing_subscriptions b where b.user_id = p.id);

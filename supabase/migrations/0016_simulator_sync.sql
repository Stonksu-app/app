-- One versioned simulator document per account. CAS serializes devices and
-- settles the PnL in the same transaction as closing the position.
alter table public.profiles add column if not exists simulator_state jsonb;
alter table public.profiles add column if not exists simulator_revision bigint not null default 0;

-- A delayed lesson/profile save from an older trading revision cannot undo PnL
-- or replace the simulator document. Only the RPC may advance its revision.
create or replace function public.protect_simulator_state()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('stonksu.simulator_write', true), '') <> 'yes' then
    if new.simulator_revision <> old.simulator_revision then
      new.coins := old.coins;
    end if;
    new.simulator_state := old.simulator_state;
    new.simulator_revision := old.simulator_revision;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_simulator_state on public.profiles;
create trigger protect_simulator_state before update on public.profiles
for each row execute function public.protect_simulator_state();

create or replace function public.simulator_read()
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object('revision', simulator_revision, 'state', simulator_state, 'coins', coins)
  from public.profiles where id = auth.uid();
$$;

create or replace function public.simulator_commit(expected_revision bigint, next_state jsonb, coin_delta integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into p from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'Profile missing'; end if;
  if p.simulator_revision <> expected_revision then
    return jsonb_build_object('accepted', false, 'revision', p.simulator_revision, 'state', p.simulator_state, 'coins', p.coins);
  end if;
  if next_state is null or jsonb_typeof(next_state) <> 'object'
     or not (next_state ?& array['openTrade','pendingOrder','tradeHistory','tradeDay','tradesToday'])
     or (next_state->'openTrade' <> 'null'::jsonb and next_state->'pendingOrder' <> 'null'::jsonb)
     or jsonb_typeof(next_state->'tradeHistory') <> 'array'
     or jsonb_array_length(next_state->'tradeHistory') > 50
     or (next_state->>'tradesToday')::integer < 0 then
    raise exception 'Invalid simulator state';
  end if;
  if coin_delta <> 0 and (p.simulator_state is null or p.simulator_state->'openTrade' = 'null'::jsonb
      or next_state->'openTrade' <> 'null'::jsonb) then
    raise exception 'Only closing a position can settle coins';
  end if;
  perform set_config('stonksu.simulator_write', 'yes', true);
  update public.profiles set simulator_state = next_state,
    simulator_revision = simulator_revision + 1,
    coins = greatest(0, coins + coin_delta)
  where id = auth.uid() returning * into p;
  perform set_config('stonksu.simulator_write', '', true);
  return jsonb_build_object('accepted', true, 'revision', p.simulator_revision, 'state', p.simulator_state, 'coins', p.coins);
end;
$$;

revoke all on function public.simulator_read() from public;
revoke all on function public.simulator_commit(bigint, jsonb, integer) from public;
grant execute on function public.simulator_read() to authenticated;
grant execute on function public.simulator_commit(bigint, jsonb, integer) to authenticated;

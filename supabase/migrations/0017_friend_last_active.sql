-- La fecha de la última práctica de un amigo, también en la lista.
--
-- La racha guardada en `profiles` solo se recalcula en el dispositivo de su
-- dueño: nada la baja por el mero paso del tiempo. Así que un amigo que dejó
-- de jugar hace nueve días sigue apareciendo con la racha que tenía el último
-- día que abrió la app, hasta que vuelva a abrirla.
--
-- Recalcularla aquí no serviría: el servidor no sabe cuántos protectores tiene
-- —y no debe decírselo a nadie más—, así que no puede decidir si la racha
-- sobrevivió al hueco. Lo que sí puede dar es la fecha, que ya publica en el
-- perfil, para que quien la pinta aplique el mismo criterio en los dos sitios.
--
-- Una columna más en el tipo de retorno significa soltar la función:
-- "create or replace" no puede cambiarlo.

drop function if exists public.friend_list();

create or replace function public.friend_list()
returns table (
  id uuid,
  name text,
  avatar jsonb,
  streak integer,
  xp integer,
  plan text,
  league_rank integer,
  last_active date,
  relation text,
  since timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select p.id, p.name, p.avatar, p.streak, p.xp, p.plan, p.league_rank,
         p.last_active_date as last_active,
         case
           when f.status = 'accepted' then 'friend'
           when f.requester_id = auth.uid() then 'outgoing'
           else 'incoming'
         end as relation,
         coalesce(f.responded_at, f.created_at) as since
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where auth.uid() in (f.requester_id, f.addressee_id)
  order by f.status desc, p.streak desc, p.name;
$$;

revoke all on function public.friend_list() from public;
grant execute on function public.friend_list() to authenticated;

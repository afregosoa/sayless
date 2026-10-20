-- Migración 015: cada invitación tiene personas (con nombre opcional) y las mesas se asignan por persona.
-- Pegar en Supabase > SQL Editor > Run. Idempotente. Requiere 001–014.
--
--  * guest_members: las personas de una invitación (familia o grupo). Hay una fila por pase: name = null es un "lugar sin nombre"
--    que el invitado completa al confirmar. Cada persona confirma por separado (attending) y tiene su mesa (table_id).
--  * guests.attending y guests.confirmed_count pasan a ser RESÚMENES que la base de datos recalcula sola a partir de las
--    personas; así siguen funcionando las estadísticas, el panel de operador y el CSV.
--  * Si cambian los pases de una invitación, se agregan o quitan personas solas (se quitan primero las sin nombre y sin confirmar).
--  * Reemplaza la versión anterior de esta migración (guest_seats): si ya la habías corrido, abajo se limpia.

begin;

-- Limpieza de la versión anterior (reparto por cantidades), si existiera.
drop function if exists public.add_guest_seats(uuid, uuid, int);
drop function if exists public.move_guest_seats(uuid, uuid, uuid);
drop table if exists public.guest_seats;

create table if not exists public.guest_members (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.guests(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  position int not null default 1,
  name text check (name is null or char_length(name) between 1 and 80),
  attending boolean,                                   -- null = aún no responde
  table_id uuid references public.event_tables(id) on delete set null
);
create index if not exists guest_members_guest_idx on public.guest_members(guest_id, position);
create index if not exists guest_members_event_idx on public.guest_members(event_id);
create index if not exists guest_members_table_idx on public.guest_members(table_id);

-- ───────────── Seguridad ─────────────
-- Las filas las crea y borra la base de datos (triggers); la app solo lee y edita nombre, asistencia y mesa.
-- El invitado confirma desde el servidor (service_role).
alter table public.guest_members enable row level security;
revoke all on public.guest_members from anon, authenticated;
grant select on public.guest_members to authenticated;
grant update (name, attending, table_id) on public.guest_members to authenticated;

drop policy if exists guest_members_editor_all on public.guest_members;
create policy guest_members_editor_all on public.guest_members
  for all to authenticated
  using (public.can_edit_event(event_id))
  with check (public.can_edit_event(event_id));

drop policy if exists guest_members_support_all on public.guest_members;
create policy guest_members_support_all on public.guest_members
  for all to authenticated
  using (public.is_superadmin() and public.support_active(event_id))
  with check (public.is_superadmin() and public.support_active(event_id));

-- La mesa de una persona debe ser de su mismo evento.
create or replace function public.guest_members_check_table()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.table_id is not null and not exists (
    select 1 from public.event_tables t where t.id = new.table_id and t.event_id = new.event_id
  ) then
    raise exception 'La mesa no pertenece a este evento' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists guest_members_check_table on public.guest_members;
create trigger guest_members_check_table
  before insert or update of table_id, event_id on public.guest_members
  for each row execute function public.guest_members_check_table();

-- ───────────── Una persona por pase ─────────────
create or replace function public.guests_sync_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  have int;
  last_pos int;
begin
  select count(*), coalesce(max(position), 0) into have, last_pos from public.guest_members where guest_id = new.id;
  if new.passes > have then
    insert into public.guest_members (guest_id, event_id, position)
    select new.id, new.event_id, last_pos + s from generate_series(1, new.passes - have) s;
  elsif new.passes < have then
    -- Se quitan primero las personas sin confirmar y sin nombre, y al final las confirmadas.
    delete from public.guest_members
    where id in (
      select id from public.guest_members where guest_id = new.id
      order by (attending is true), (name is not null), position desc
      limit have - new.passes
    );
  end if;
  return null;
end;
$$;

drop trigger if exists guests_sync_members on public.guests;
create trigger guests_sync_members
  after insert or update of passes on public.guests
  for each row execute function public.guests_sync_members();

-- ───────────── Resumen en la invitación ─────────────
-- attending: null si nadie ha respondido; true si al menos una persona asiste; false si todas las que respondieron no asisten.
-- confirmed_count: personas que asisten (null mientras nadie responde).
create or replace function public.guest_members_recompute()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest uuid := coalesce(new.guest_id, old.guest_id);
begin
  update public.guests g
  set attending = (
        select case when count(m.attending) = 0 then null when bool_or(m.attending) then true else false end
        from public.guest_members m where m.guest_id = g.id
      ),
      confirmed_count = (
        select case when count(m.attending) = 0 then null else count(*) filter (where m.attending is true) end
        from public.guest_members m where m.guest_id = g.id
      )
  where g.id = v_guest;
  return null;
end;
$$;

drop trigger if exists guest_members_recompute on public.guest_members;
create trigger guest_members_recompute
  after insert or update of attending or delete on public.guest_members
  for each row execute function public.guest_members_recompute();

-- ───────────── Personas para las invitaciones que ya existían ─────────────
-- Una por pase. Si ya habían respondido, las primeras `confirmed_count` quedan como asistentes y el resto como no asistentes.
-- La mesa que tenía la invitación (014) pasa a todas sus personas.
insert into public.guest_members (guest_id, event_id, position, attending, table_id)
select g.id, g.event_id, s,
       case when g.attending is true then s <= coalesce(g.confirmed_count, g.passes)
            when g.attending is false then false
            else null end,
       g.table_id
from public.guests g
cross join lateral generate_series(1, g.passes) s
where not exists (select 1 from public.guest_members m where m.guest_id = g.id);

-- ───────────── Borrado de datos: ahora también los nombres de las personas ─────────────
create or replace function public.anonymize_old_guests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
  enabled boolean;
begin
  select (s.value)::text::boolean into enabled from public.app_settings s where s.key = 'retention_enabled';
  if not coalesce(enabled, false) then
    return 0;
  end if;

  with due as (
    select e.id from public.events e
    where e.event_date is not null
      and (now() at time zone e.timezone)::date > e.event_date + 90
  ), upd as (
    update public.guests g
    set name = 'Invitado (datos eliminados)', phone = null, message = null, anonymized_at = now()
    from due
    where g.event_id = due.id and g.anonymized_at is null
    returning g.id, g.event_id
  ), people as (
    update public.guest_members m set name = null
    where m.guest_id in (select id from upd)
  ), summary as (
    select event_id, count(*) as c from upd group by event_id
  ), logged as (
    insert into public.audit_log (event_id, action, details)
    select event_id, 'guests_anonymized', jsonb_build_object('count', c, 'reason', 'retention') from summary
  )
  select coalesce(sum(c), 0)::integer into n from summary;
  return n;
end;
$$;

revoke all on function public.anonymize_old_guests() from public, anon, authenticated;

commit;

-- Migración 014: orden de invitados por mesa.
-- Pegar en Supabase > SQL Editor > Run. Idempotente. Requiere 001–013 (usa can_edit_event, is_superadmin y support_active).
--
--  * event_tables: las mesas de un evento (nombre y capacidad). Las administra quien puede editar el evento.
--  * guests.table_id: la mesa de cada invitación (familia o grupo). Si se borra la mesa, el invitado queda "sin mesa".
--  * Un trigger impide asignar un invitado a una mesa de OTRO evento.

begin;

create table if not exists public.event_tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  capacity int not null default 10 check (capacity between 1 and 50),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists event_tables_event_idx on public.event_tables(event_id, position);

alter table public.guests add column if not exists table_id uuid references public.event_tables(id) on delete set null;
create index if not exists guests_table_idx on public.guests(table_id);

-- ───────────── Seguridad ─────────────
alter table public.event_tables enable row level security;
revoke all on public.event_tables from anon, authenticated;
grant select, delete on public.event_tables to authenticated;
grant insert (event_id, name, capacity, position) on public.event_tables to authenticated;
grant update (name, capacity, position) on public.event_tables to authenticated;
-- La asignación de mesa es la única columna de invitados que se agrega a los permisos de edición.
grant update (table_id) on public.guests to authenticated;

drop policy if exists event_tables_editor_all on public.event_tables;
create policy event_tables_editor_all on public.event_tables
  for all to authenticated
  using (public.can_edit_event(event_id))
  with check (public.can_edit_event(event_id));

-- Soporte (superadmin) solo con el acceso temporal que da el dueño.
drop policy if exists event_tables_support_all on public.event_tables;
create policy event_tables_support_all on public.event_tables
  for all to authenticated
  using (public.is_superadmin() and public.support_active(event_id))
  with check (public.is_superadmin() and public.support_active(event_id));

-- La mesa de un invitado debe ser de su mismo evento.
create or replace function public.guests_check_table()
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

drop trigger if exists guests_check_table on public.guests;
create trigger guests_check_table
  before insert or update of table_id, event_id on public.guests
  for each row execute function public.guests_check_table();

commit;

-- Migración 012: arregla "new row violates row-level security policy for table events" al crear un evento.
-- Pegar en Supabase > SQL Editor > Run. Idempotente. Correr en sayless-dev y en producción.
--
-- Causa: createEvent hace INSERT ... RETURNING, y Postgres exige que la fila nueva cumpla también la política de LECTURA.
-- La migración 007 la dejó como can_edit_event(id), una función STABLE que consulta public.events: dentro de la misma
-- sentencia no ve la fila que se está insertando, así que devolvía falso y el insert fallaba (42501).
-- Solución: aceptar también owner_id = auth.uid(), que se evalúa sobre la propia fila.

begin;

drop policy if exists events_select_own on public.events;
create policy events_select_own on public.events
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.can_edit_event(id));

commit;

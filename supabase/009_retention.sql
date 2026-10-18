-- Migración 009: cierre automático de eventos y retención de datos de invitados.
-- Pegar completo en Supabase > SQL Editor > Run. Idempotente.
--
--  * close_finished_events(): publica -> cerrado el día DESPUÉS de la fecha del evento (en su zona horaria).
--  * anonymize_old_guests(): 90 días después del evento borra nombre, teléfono y mensaje de los invitados
--    (se conservan pases y conteos de confirmación). Solo actúa si el interruptor 'retention_enabled' está en true.
--  * Eventos sin fecha no se cierran ni se anonimizan solos.
-- La programación diaria está en 010_schedule_retention.sql.

begin;

alter table public.guests add column if not exists anonymized_at timestamptz;

-- Interruptores de la plataforma (solo servidor).
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

-- El borrado automático empieza APAGADO: se enciende cuando existan los avisos por correo.
insert into public.app_settings (key, value) values ('retention_enabled', 'false'::jsonb)
on conflict (key) do nothing;

create or replace function public.close_finished_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  with closed as (
    update public.events e
    set status = 'closed'
    where e.status = 'published'
      and e.event_date is not null
      and (now() at time zone e.timezone)::date > e.event_date
    returning e.id
  ), logged as (
    insert into public.audit_log (event_id, action)
    select id, 'event_auto_closed' from closed
  )
  select count(*) into n from closed;
  return n;
end;
$$;

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
    returning g.event_id
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

-- Solo el programador (pg_cron / postgres) y service_role pueden ejecutarlas.
revoke all on function public.close_finished_events() from public, anon, authenticated;
revoke all on function public.anonymize_old_guests() from public, anon, authenticated;

commit;

-- Migración 020: seguimiento de quién abrió su invitación personal.
-- Pegar en Supabase > SQL Editor > Run. Idempotente. Requiere 001–019.
--
--  * guests.first_opened_at / last_opened_at / open_count: cuándo y cuántas veces se abrió el enlace personal del invitado.
--  * Solo cuenta aperturas reales (las registra el navegador del invitado, no los rastreadores de vistas previas de WhatsApp,
--    iMessage, etc.) y no las del propio anfitrión o sus colaboradores.
--  * Es un dato de comportamiento: el borrado de datos de invitados (manual y automático) también lo elimina.

begin;

alter table public.guests add column if not exists first_opened_at timestamptz;
alter table public.guests add column if not exists last_opened_at timestamptz;
alter table public.guests add column if not exists open_count int not null default 0;

-- Registra una apertura. Solo el servidor (service_role) la puede llamar.
create or replace function public.record_guest_open(p_guest uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.guests
  set first_opened_at = coalesce(first_opened_at, now()),
      last_opened_at = now(),
      open_count = open_count + 1
  where id = p_guest and anonymized_at is null;
$$;

revoke all on function public.record_guest_open(uuid) from public, anon, authenticated;

-- Borrado automático: ahora también limpia las aperturas.
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
    set name = 'Invitado (datos eliminados)', phone = null, message = null, anonymized_at = now(),
        first_opened_at = null, last_opened_at = null, open_count = 0
    from due
    where g.event_id = due.id and g.anonymized_at is null
    returning g.id, g.event_id
  ), people as (
    update public.guest_members m set name = null, diet = '{}', allergies = null
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

-- Migración 018: preferencias alimentarias y alergias por persona.
-- Pegar en Supabase > SQL Editor > Run. Idempotente. Requiere 001–017.
--
--  * guest_members.diet: etiquetas de una lista fija (vegetariano, vegano, sin gluten…).
--  * guest_members.allergies: texto libre (máx. 200 caracteres).
--  * Son datos de salud: el borrado de datos de invitados (manual y automático) también los elimina.
--  * El invitado los escribe al confirmar (desde el servidor); el anfitrión puede editarlos.

begin;

alter table public.guest_members add column if not exists diet text[] not null default '{}';
alter table public.guest_members add column if not exists allergies text;

alter table public.guest_members drop constraint if exists guest_members_diet_check;
alter table public.guest_members add constraint guest_members_diet_check
  check (diet <@ array['vegetarian', 'vegan', 'pescetarian', 'gluten_free', 'dairy_free', 'halal', 'kosher']::text[]);

alter table public.guest_members drop constraint if exists guest_members_allergies_check;
alter table public.guest_members add constraint guest_members_allergies_check
  check (allergies is null or char_length(allergies) <= 200);

grant update (diet, allergies) on public.guest_members to authenticated;

-- Borrado automático: ahora también limpia la alimentación y las alergias de cada persona.
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

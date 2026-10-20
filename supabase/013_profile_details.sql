-- Migración 013: datos del perfil al registrarse (nombre, teléfono opcional y aceptación de términos).
-- Pegar en Supabase > SQL Editor > Run. Idempotente. Correr en sayless-dev y en producción (después de 001–012).
--
--  * El nombre llega en los metadatos del usuario: con Google como `full_name`/`name`, con correo y contraseña lo manda el
--    formulario de registro. El teléfono (opcional) también viaja en los metadatos.
--  * terms_accepted_at lo escribe solo el servidor (service_role) cuando la persona acepta los Términos de uso.
--  * Se conserva TODA la lógica de la versión de la migración 007 (asignar eventos y colaboraciones en espera).

begin;

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name, phone)
  values (
    new.id,
    new.email,
    nullif(left(trim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')), 80), ''),
    nullif(left(trim(coalesce(new.raw_user_meta_data->>'phone', '')), 20), '')
  )
  on conflict (id) do nothing;

  update public.events e
  set owner_id = new.id
  from public.owner_invites i
  where i.event_id = e.id and lower(i.email) = lower(new.email) and e.owner_id is null;
  delete from public.owner_invites where lower(email) = lower(new.email);

  insert into public.event_members (event_id, user_id)
  select i.event_id, new.id from public.member_invites i
  where lower(i.email) = lower(new.email)
  on conflict do nothing;
  delete from public.member_invites where lower(email) = lower(new.email);

  return new;
end;
$$;

-- Usuarios que ya existen con Google: se rellena el nombre desde sus metadatos.
update public.profiles p
set name = nullif(left(trim(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')), 80), '')
from auth.users u
where u.id = p.id and p.name is null;

commit;

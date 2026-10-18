-- Migración 007: colaboradores por evento.
-- Pegar completo en Supabase > SQL Editor > Run. Idempotente.
--
--  * El dueño (events.owner_id) sigue siendo quien paga y administra el acceso de soporte y a los colaboradores.
--  * Los colaboradores (event_members) editan contenido, fotos e invitados.
--  * Se invitan por correo; si la persona aún no se registra, la invitación espera (member_invites).

begin;

create table if not exists public.event_members (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists event_members_user_idx on public.event_members(user_id);

create table if not exists public.member_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  unique (event_id, email)
);

alter table public.event_members enable row level security;
alter table public.member_invites enable row level security;
revoke all on public.event_members, public.member_invites from anon, authenticated;
revoke all on public.member_invites from authenticated; -- solo service_role
grant select on public.event_members to authenticated;  -- las altas y bajas las hace el servidor

-- ───────────── Funciones de permiso ─────────────
-- Dueño o colaborador del evento. Es security definer para evitar recursión entre políticas.
create or replace function public.can_edit_event(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.events e where e.id = p_event and e.owner_id = (select auth.uid()))
      or exists (select 1 from public.event_members m where m.event_id = p_event and m.user_id = (select auth.uid()));
$$;

revoke all on function public.can_edit_event(uuid) from public, anon;
grant execute on function public.can_edit_event(uuid) to authenticated;

drop policy if exists event_members_select on public.event_members;
create policy event_members_select on public.event_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.can_edit_event(event_id) or public.is_superadmin());

-- ───────────── Políticas que antes miraban solo al dueño ─────────────
drop policy if exists events_select_own on public.events;
create policy events_select_own on public.events
  for select to authenticated using (public.can_edit_event(id));

drop policy if exists events_update_own on public.events;
create policy events_update_own on public.events
  for update to authenticated
  using (public.can_edit_event(id))
  with check (public.can_edit_event(id));

drop policy if exists guests_owner_all on public.guests;
create policy guests_owner_all on public.guests
  for all to authenticated
  using (public.can_edit_event(event_id))
  with check (public.can_edit_event(event_id));

drop policy if exists event_media_owner_select on storage.objects;
create policy event_media_owner_select on storage.objects
  for select to authenticated
  using (bucket_id = 'event-media' and exists (
    select 1 from public.events e where e.id::text = (storage.foldername(name))[1] and public.can_edit_event(e.id)));

drop policy if exists event_media_owner_insert on storage.objects;
create policy event_media_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'event-media' and exists (
    select 1 from public.events e where e.id::text = (storage.foldername(name))[1] and public.can_edit_event(e.id)));

drop policy if exists event_media_owner_delete on storage.objects;
create policy event_media_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'event-media' and exists (
    select 1 from public.events e where e.id::text = (storage.foldername(name))[1] and public.can_edit_event(e.id)));

drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log
  for select to authenticated
  using (public.is_superadmin() or public.can_edit_event(event_id));

-- ───────────── El acceso de soporte lo da solo el dueño (acción del servidor) ─────────────
-- Un colaborador puede editar contenido, pero no abrir el evento a soporte.
revoke update (support_access_until) on public.events from authenticated;

-- Un colaborador o dueño editando no es "soporte": no se registra en la bitácora de soporte.
create or replace function public.audit_support_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event uuid;
  v_action text;
  v_details jsonb := '{}'::jsonb;
begin
  if not public.is_superadmin() then
    return null;
  end if;

  if tg_table_name = 'events' then
    v_event := new.id;
    v_action := 'support_edit_event';
    v_details := jsonb_build_object('changed', (
      select coalesce(jsonb_agg(n.key), '[]'::jsonb)
      from jsonb_each(to_jsonb(new)) n
      where n.key <> 'updated_at' and (to_jsonb(old) -> n.key) is distinct from n.value
    ));
  else
    v_action := 'support_guest_' || lower(tg_op);
    if tg_op = 'DELETE' then
      v_event := old.event_id;
      v_details := jsonb_build_object('guest_id', old.id);
    else
      v_event := new.event_id;
      v_details := jsonb_build_object('guest_id', new.id);
    end if;
  end if;

  if public.can_edit_event(v_event) then
    return null; -- el superadmin editando un evento donde es dueño o colaborador no es "soporte"
  end if;

  insert into public.audit_log (actor_id, event_id, action, details)
  values ((select auth.uid()), v_event, v_action, v_details);
  return null;
end;
$$;

-- ───────────── Al registrarse: reclamar eventos y colaboraciones pendientes ─────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
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

commit;

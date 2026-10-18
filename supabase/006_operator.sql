  -- Migración 006: panel de operador, permiso de soporte y registro de actividad.
  -- Pegar completo en Supabase > SQL Editor > Run. Idempotente.
  --
  -- Qué cambia:
  --  * El superadmin SIGUE viendo todos los eventos y sus conteos, pero ya NO puede ver ni editar
  --    invitados, ni editar contenido, salvo que el cliente haya dado acceso de soporte
  --    (events.support_access_until en el futuro).
  --  * Todo cambio de un superadmin en un evento ajeno queda en audit_log (lo registra la base de datos).
  --  * Eventos sin dueño pueden asignarse por correo, aunque la persona aún no se haya registrado.

  begin;

  -- ───────────── Acceso de soporte ─────────────
  alter table public.events add column if not exists support_access_until timestamptz;

  -- El dueño puede dar o revocar acceso (columna editable por él; las políticas de dueño ya aplican).
  grant update (support_access_until) on public.events to authenticated;

  create or replace function public.support_active(p_event uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
  as $$
    select exists (
      select 1 from public.events e
      where e.id = p_event and e.support_access_until is not null and e.support_access_until > now()
    );
  $$;

  revoke all on function public.support_active(uuid) from public, anon;
  grant execute on function public.support_active(uuid) to authenticated;

  -- Superadmin: editar evento e invitados SOLO con acceso de soporte vigente.
  drop policy if exists events_update_superadmin on public.events;
  create policy events_update_superadmin on public.events
    for update to authenticated
    using (public.is_superadmin() and public.support_active(id))
    with check (public.is_superadmin() and public.support_active(id));

  drop policy if exists guests_superadmin_all on public.guests;
  create policy guests_superadmin_all on public.guests
    for all to authenticated
    using (public.is_superadmin() and public.support_active(event_id))
    with check (public.is_superadmin() and public.support_active(event_id));

  -- Fotos: el superadmin también necesita acceso de soporte para tocar la carpeta de un evento.
  drop policy if exists event_media_support_select on storage.objects;
  create policy event_media_support_select on storage.objects
    for select to authenticated
    using (
      bucket_id = 'event-media' and public.is_superadmin()
      and exists (select 1 from public.events e
                  where e.id::text = (storage.foldername(name))[1] and public.support_active(e.id))
    );

  drop policy if exists event_media_support_insert on storage.objects;
  create policy event_media_support_insert on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'event-media' and public.is_superadmin()
      and exists (select 1 from public.events e
                  where e.id::text = (storage.foldername(name))[1] and public.support_active(e.id))
    );

  drop policy if exists event_media_support_delete on storage.objects;
  create policy event_media_support_delete on storage.objects
    for delete to authenticated
    using (
      bucket_id = 'event-media' and public.is_superadmin()
      and exists (select 1 from public.events e
                  where e.id::text = (storage.foldername(name))[1] and public.support_active(e.id))
    );

  -- ───────────── Conteos para el operador (sin nombres) ─────────────
  create or replace function public.event_guest_stats()
  returns table (event_id uuid, guests bigint, answered bigint, people bigint)
  language sql
  stable
  security definer
  set search_path = ''
  as $$
    select g.event_id,
          count(*),
          count(g.attending),
          coalesce(sum(g.confirmed_count) filter (where g.attending), 0)::bigint
    from public.guests g
    where public.is_superadmin()
    group by g.event_id;
  $$;

  revoke all on function public.event_guest_stats() from public, anon;
  grant execute on function public.event_guest_stats() to authenticated;

  -- ───────────── Registro de actividad ─────────────
  create table if not exists public.audit_log (
    id bigint generated always as identity primary key,
    at timestamptz not null default now(),
    actor_id uuid,
    event_id uuid references public.events(id) on delete set null,
    action text not null,
    details jsonb not null default '{}'::jsonb
  );
  create index if not exists audit_log_event_idx on public.audit_log(event_id, at desc);

  alter table public.audit_log enable row level security;
  revoke all on public.audit_log from anon, authenticated;
  grant select on public.audit_log to authenticated;

  -- Lo ve el dueño del evento (transparencia) y el superadmin. Solo se escribe desde triggers
  -- y desde el servidor (service_role); los usuarios no pueden insertar ni borrar.
  drop policy if exists audit_log_select on public.audit_log;
  create policy audit_log_select on public.audit_log
    for select to authenticated
    using (
      public.is_superadmin()
      or exists (select 1 from public.events e where e.id = audit_log.event_id and e.owner_id = (select auth.uid()))
    );

  -- Registra automáticamente cuando un superadmin cambia algo de un evento que NO es suyo.
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

    if (select e.owner_id from public.events e where e.id = v_event) is not distinct from (select auth.uid()) then
      return null; -- el superadmin editando su propio evento no es "soporte"
    end if;

    insert into public.audit_log (actor_id, event_id, action, details)
    values ((select auth.uid()), v_event, v_action, v_details);
    return null;
  end;
  $$;

  drop trigger if exists audit_events_support on public.events;
  create trigger audit_events_support
    after update on public.events
    for each row execute function public.audit_support_change();

  drop trigger if exists audit_guests_support on public.guests;
  create trigger audit_guests_support
    after insert or update or delete on public.guests
    for each row execute function public.audit_support_change();

  -- ───────────── Asignar dueño por correo ─────────────
  create table if not exists public.owner_invites (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    event_id uuid not null references public.events(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (email, event_id)
  );
  alter table public.owner_invites enable row level security;
  revoke all on public.owner_invites from anon, authenticated; -- solo service_role

  -- Al registrarse alguien, reclama los eventos sin dueño que se le asignaron por correo.
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
    return new;
  end;
  $$;

  commit;

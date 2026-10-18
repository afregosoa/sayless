-- Migración 005: almacenamiento de fotos de eventos.
-- Pegar en Supabase > SQL Editor > Run. Idempotente.
--
-- Bucket público (las fotos se ven en invitaciones públicas). Solo se aceptan archivos WebP de
-- hasta 5 MB: la app convierte y reduce cada foto antes de subirla.
-- Ruta de cada archivo: <event_id>/<uuid>.webp. Solo el dueño del evento puede escribir en su carpeta.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-media', 'event-media', true, 5242880, array['image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/webp'];

drop policy if exists event_media_owner_select on storage.objects;
create policy event_media_owner_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'event-media'
    and exists (
      select 1 from public.events e
      where e.id::text = (storage.foldername(name))[1] and e.owner_id = (select auth.uid())
    )
  );

drop policy if exists event_media_owner_insert on storage.objects;
create policy event_media_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'event-media'
    and exists (
      select 1 from public.events e
      where e.id::text = (storage.foldername(name))[1] and e.owner_id = (select auth.uid())
    )
  );

drop policy if exists event_media_owner_delete on storage.objects;
create policy event_media_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'event-media'
    and exists (
      select 1 from public.events e
      where e.id::text = (storage.foldername(name))[1] and e.owner_id = (select auth.uid())
    )
  );

commit;

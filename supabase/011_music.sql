-- Migración 011: música de fondo en la invitación.
-- Pegar en Supabase > SQL Editor > Run. Idempotente. Requiere haber corrido 001–010 (usa can_edit_event y support_active).
--
-- Bucket público (el invitado reproduce el MP3 desde la invitación pública). Solo audio/mpeg, máx. 4 MB
-- (~4 min a 128 kbps; la subida pasa por una Server Action y Vercel limita la petición a ~4.5 MB).
-- Ruta de cada archivo: <event_id>/<uuid>.mp3. Quien puede editar el evento (dueño, colaborador o soporte activo)
-- puede escribir en su carpeta, igual que con las fotos.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-audio', 'event-audio', true, 4194304, array['audio/mpeg'])
on conflict (id) do update
  set public = true, file_size_limit = 4194304, allowed_mime_types = array['audio/mpeg'];

drop policy if exists event_audio_editor_select on storage.objects;
create policy event_audio_editor_select on storage.objects
  for select to authenticated
  using (bucket_id = 'event-audio' and exists (
    select 1 from public.events e where e.id::text = (storage.foldername(name))[1] and public.can_edit_event(e.id)));

drop policy if exists event_audio_editor_insert on storage.objects;
create policy event_audio_editor_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'event-audio' and exists (
    select 1 from public.events e where e.id::text = (storage.foldername(name))[1] and public.can_edit_event(e.id)));

drop policy if exists event_audio_editor_delete on storage.objects;
create policy event_audio_editor_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'event-audio' and exists (
    select 1 from public.events e where e.id::text = (storage.foldername(name))[1] and public.can_edit_event(e.id)));

-- Soporte (superadmin) solo con el acceso temporal que da el dueño.
drop policy if exists event_audio_support_select on storage.objects;
create policy event_audio_support_select on storage.objects
  for select to authenticated
  using (bucket_id = 'event-audio' and public.is_superadmin() and exists (
    select 1 from public.events e where e.id::text = (storage.foldername(name))[1] and public.support_active(e.id)));

drop policy if exists event_audio_support_insert on storage.objects;
create policy event_audio_support_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'event-audio' and public.is_superadmin() and exists (
    select 1 from public.events e where e.id::text = (storage.foldername(name))[1] and public.support_active(e.id)));

drop policy if exists event_audio_support_delete on storage.objects;
create policy event_audio_support_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'event-audio' and public.is_superadmin() and exists (
    select 1 from public.events e where e.id::text = (storage.foldername(name))[1] and public.support_active(e.id)));

commit;

-- Migración 003: permisos de superadmin vía RLS (para el panel /admin sin service_role).
-- Pegar en Supabase > SQL Editor > Run. Idempotente.

begin;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_superadmin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

revoke all on function public.is_superadmin() from public, anon;
grant execute on function public.is_superadmin() to authenticated;

drop policy if exists profiles_select_superadmin on public.profiles;
create policy profiles_select_superadmin on public.profiles
  for select to authenticated using (public.is_superadmin());

drop policy if exists events_select_superadmin on public.events;
create policy events_select_superadmin on public.events
  for select to authenticated using (public.is_superadmin());

drop policy if exists guests_superadmin_all on public.guests;
create policy guests_superadmin_all on public.guests
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

commit;

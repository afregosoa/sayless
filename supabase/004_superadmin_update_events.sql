-- Migración 004: el superadmin puede editar el contenido de cualquier evento (soporte a clientes).
-- Las columnas editables siguen limitadas por los GRANT de la migración 001
-- (no incluyen status, paid_at, plan ni slug).
-- Pegar en Supabase > SQL Editor > Run. Idempotente.

drop policy if exists events_update_superadmin on public.events;
create policy events_update_superadmin on public.events
  for update to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

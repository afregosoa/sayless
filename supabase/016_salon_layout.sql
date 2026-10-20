-- Migración 016: plano libre del salón (posición, forma y giro de las mesas, más elementos del salón).
-- Pegar en Supabase > SQL Editor > Run. Idempotente. Requiere 001–015 (usa event_tables y las funciones de permiso).
--
--  * event_tables: x, y (posición en el lienzo; null = aún sin colocar), shape (forma) y rotation (giro en grados).
--  * event_layout_items: elementos del salón que no son mesas (pista de baile, escenario, barra, entrada…).
--    Las coordenadas están en unidades del lienzo (1200 de ancho; el alto crece según el contenido).

begin;

alter table public.event_tables add column if not exists x numeric check (x is null or x between 0 and 1200);
alter table public.event_tables add column if not exists y numeric check (y is null or y between 0 and 2400);
alter table public.event_tables add column if not exists shape text not null default 'auto'
  check (shape in ('auto', 'round', 'rect', 'head'));
alter table public.event_tables add column if not exists rotation int not null default 0
  check (rotation between -360 and 360);

grant update (x, y, shape, rotation) on public.event_tables to authenticated;
grant insert (x, y, shape, rotation) on public.event_tables to authenticated;

create table if not exists public.event_layout_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  kind text not null check (kind in ('dance', 'stage', 'bar', 'entrance', 'gifts', 'dj', 'restrooms', 'other')),
  label text not null default '' check (char_length(label) <= 40),
  x numeric not null check (x between 0 and 1200),
  y numeric not null check (y between 0 and 2400),
  w numeric not null check (w between 20 and 1200),
  h numeric not null check (h between 20 and 800),
  rotation int not null default 0 check (rotation between -360 and 360),
  created_at timestamptz not null default now()
);
create index if not exists event_layout_items_event_idx on public.event_layout_items(event_id);

-- ───────────── Seguridad (igual que las mesas) ─────────────
alter table public.event_layout_items enable row level security;
revoke all on public.event_layout_items from anon, authenticated;
grant select, delete on public.event_layout_items to authenticated;
grant insert (event_id, kind, label, x, y, w, h, rotation) on public.event_layout_items to authenticated;
grant update (label, x, y, w, h, rotation) on public.event_layout_items to authenticated;

drop policy if exists event_layout_items_editor_all on public.event_layout_items;
create policy event_layout_items_editor_all on public.event_layout_items
  for all to authenticated
  using (public.can_edit_event(event_id))
  with check (public.can_edit_event(event_id));

drop policy if exists event_layout_items_support_all on public.event_layout_items;
create policy event_layout_items_support_all on public.event_layout_items
  for all to authenticated
  using (public.is_superadmin() and public.support_active(event_id))
  with check (public.is_superadmin() and public.support_active(event_id));

commit;

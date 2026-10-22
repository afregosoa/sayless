-- Migración 021: registro de avisos enviados a los invitados (modo guiado de recordatorios por WhatsApp).
-- Pegar en Supabase > SQL Editor > Run. Idempotente. Requiere 001–020 (usa can_edit_event, is_superadmin y support_active).
--
--  * guest_contacts: cada vez que el anfitrión marca "ya lo envié" a un invitado queda un registro (quién, cuándo y qué tipo).
--    Sirve para no repetir avisos y saber cuándo fue el último. No guarda el texto del mensaje ni datos personales.
--  * Lo escribe quien puede editar el evento (dueño, colaborador o soporte con permiso del dueño).

begin;

create table if not exists public.guest_contacts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  kind text not null check (kind in ('invitacion', 'sin_abrir', 'vieron', 'pendientes')),
  channel text not null default 'whatsapp' check (channel = 'whatsapp'),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists guest_contacts_guest_idx on public.guest_contacts(guest_id, created_at desc);
create index if not exists guest_contacts_event_idx on public.guest_contacts(event_id, created_at desc);

-- ───────────── Seguridad ─────────────
alter table public.guest_contacts enable row level security;
revoke all on public.guest_contacts from anon, authenticated;
grant select, delete on public.guest_contacts to authenticated;
grant insert (event_id, guest_id, kind) on public.guest_contacts to authenticated;

drop policy if exists guest_contacts_editor_all on public.guest_contacts;
create policy guest_contacts_editor_all on public.guest_contacts
  for all to authenticated
  using (public.can_edit_event(event_id))
  with check (public.can_edit_event(event_id));

drop policy if exists guest_contacts_support_all on public.guest_contacts;
create policy guest_contacts_support_all on public.guest_contacts
  for all to authenticated
  using (public.is_superadmin() and public.support_active(event_id))
  with check (public.is_superadmin() and public.support_active(event_id));

-- El invitado debe ser del mismo evento (no se puede registrar un aviso a un invitado de otro evento).
create or replace function public.guest_contacts_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.guests g where g.id = new.guest_id and g.event_id = new.event_id) then
    raise exception 'El invitado no pertenece a este evento' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists guest_contacts_check on public.guest_contacts;
create trigger guest_contacts_check
  before insert or update on public.guest_contacts
  for each row execute function public.guest_contacts_check();

commit;

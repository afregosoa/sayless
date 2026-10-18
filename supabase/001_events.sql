-- Migración 001: soporte multi-evento
-- Pegar completo en Supabase > SQL Editor > Run. Es idempotente (se puede correr más de una vez).
-- Requiere que ya exista la tabla public.guests (supabase/schema.sql).
-- No cambia nada para los invitados: la app actual sigue funcionando igual.

begin;

-- ───────────────────────── profiles ─────────────────────────
-- Una fila por usuario de Supabase Auth (clientes y tú).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  is_superadmin boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── events ─────────────────────────
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null, -- null = aún sin dueño asignado
  slug text not null unique,
  type text not null default 'boda',          -- boda, xv, bautizo, cumpleanos, otro
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  template text not null default 'editorial',
  event_date date,
  rsvp_deadline date,
  timezone text not null default 'America/Mexico_City',
  locale text not null default 'es',
  content jsonb not null default '{}'::jsonb,  -- textos y secciones editables por el cliente
  theme jsonb not null default '{}'::jsonb,    -- colores, fuentes, ilustración
  plan text not null default 'standard',
  paid_at timestamptz,                         -- lo escribe solo el servidor (webhook de pago)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  constraint events_slug_reserved check (slug not in
    ('app', 'admin', 'api', 'login', 'auth', 'invitacion', 'static', 'www', 'precios', 'contacto'))
);

create index if not exists events_owner_idx on public.events(owner_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- ───────────────────────── guests.event_id ─────────────────────────
alter table public.guests add column if not exists event_id uuid references public.events(id) on delete cascade;
create index if not exists guests_event_idx on public.guests(event_id);

-- ───────────────────────── Tu boda como primer evento ─────────────────────────
insert into public.events (slug, type, title, status, event_date, rsvp_deadline, paid_at, content, theme)
values (
  'illian-y-alfredo', 'boda', 'Illian & Alfredo', 'published',
  '2027-02-27', '2026-12-10', now(),
  $json$
  {
    "hero": {
      "title": "Illian & Alfredo",
      "date_label": "27 de febrero 2027",
      "subtitle": "Colima, México"
    },
    "welcome": {
      "enabled": true,
      "eyebrow": "Aquí comienza",
      "heading": "Nuestro para siempre",
      "heading_script": "juntos",
      "body": "Con el corazón lleno de gratitud, queremos invitarte a acompañarnos el día que unimos nuestras vidas. Esta celebración también es de las familias y amistades que nos han formado y nos trajeron hasta aquí.",
      "quote": "Tenerte con nosotros ese día significaría más de lo que podemos decir."
    },
    "countdown": { "enabled": true, "date_label": "Sábado 27 de febrero de 2027" },
    "venues": {
      "enabled": true,
      "eyebrow": "Sábado 27 de febrero de 2027",
      "items": [
        {
          "label": "Ceremonia religiosa",
          "name": "Santuario San Juan Pablo II",
          "time": "6:00 PM",
          "address": "Colima, Col.",
          "map_query": "Santuario San Juan Pablo II Colima"
        },
        {
          "label": "Recepción",
          "name": "Dos Vistas Jardín",
          "time": "7:30 PM",
          "address": "Colima, Col.",
          "map_query": "Dos Vistas Jardin Colima"
        }
      ]
    },
    "schedule": {
      "enabled": true,
      "items": [
        { "time": "6:00 PM", "label": "Ceremonia religiosa" },
        { "time": "7:30 PM", "label": "Llegada a Dos Vistas Jardín · cóctel" },
        { "time": "8:30 PM", "label": "Entrada de los novios" },
        { "time": "9:00 PM", "label": "Cena" },
        { "time": "9:45 PM", "label": "Primer baile" },
        { "time": "10:00 PM", "label": "Fiesta" }
      ]
    },
    "dress_code": {
      "enabled": true,
      "body": "Formal. No hay colores definidos; solo te pedimos evitar el blanco y el rojo. Como la recepción es en jardín, te recomendamos calzado cómodo, como tacón grueso.",
      "quote": "Lo más importante es que uses algo con lo que te sientas increíble y listo para celebrar con nosotros."
    },
    "gifts": {
      "enabled": true,
      "body": "Lo más valioso para nosotros es tenerte cerca ese día. Si además deseas tener un detalle con nosotros, aquí encontrarás nuestra mesa de regalos.",
      "button_label": "Ver mesa de regalos",
      "url": "https://zepika.com/pages/boda-illian-y-alfredo"
    },
    "lodging": {
      "enabled": true,
      "items": [
        { "name": "[Hotel 1]", "address": "[Dirección · minutos del salón]" },
        { "name": "[Hotel 2]", "address": "[Dirección · minutos del salón]" }
      ]
    },
    "faq": {
      "enabled": true,
      "items": [
        { "q": "¿Puedo llevar acompañante?", "a": "Tu invitación indica el número de pases asignados. Por espacio, solo podemos recibir a las personas incluidas en ella." },
        { "q": "¿La celebración es al aire libre?", "a": "[La recepción es en jardín. Agrega aquí si habrá techo o carpa y qué clima esperar en Colima a finales de febrero.]" },
        { "q": "¿Pueden ir niños?", "a": "[Respuesta por definir.]" },
        { "q": "¿Hasta cuándo puedo confirmar?", "a": "Hasta el 10 de diciembre. Puedes cambiar tu respuesta con tu mismo código antes de esa fecha." }
      ]
    },
    "footer": { "monogram": "I | A", "line": "27 · 02 · 2027 · Colima" }
  }
  $json$::jsonb,
  $json$
  {
    "hero_art": "volcanes-colima",
    "fonts": { "display": "Bodoni Moda", "body": "Poppins", "script": "Mrs Saint Delafield" },
    "light": { "paper": "#ECEBE4", "ink": "#22241F", "muted": "#62655B", "accent": "#55623F", "line": "#CBCBBF", "card": "#E3E2D9" },
    "dark":  { "paper": "#161814", "ink": "#E9E8E0", "muted": "#A5A89C", "accent": "#AFBD93", "line": "#34372F", "card": "#1E211B" }
  }
  $json$::jsonb
)
on conflict (slug) do nothing;

-- Asigna todos los invitados existentes a esa boda y exige event_id a partir de ahora.
update public.guests
set event_id = (select id from public.events where slug = 'illian-y-alfredo')
where event_id is null;

alter table public.guests alter column event_id set not null;

-- NOTA: guests.code sigue siendo único global. En la fase 2 (rutas por slug) pasará a
-- ser único por evento: unique (event_id, code).

-- ───────────────────────── Seguridad ─────────────────────────
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.guests enable row level security;

-- La app pública y el panel actual usan service_role (ignora RLS). Los usuarios
-- autenticados (clientes) solo reciben los permisos mínimos de abajo.
revoke all on public.profiles, public.events, public.guests from anon, authenticated;

-- profiles: cada usuario solo lee la suya (no puede editarla, así no se auto-asciende a superadmin).
grant select on public.profiles to authenticated;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));

-- events: el dueño lee, crea y edita sus eventos, pero NO puede tocar
-- status, paid_at, plan ni slug (los maneja el servidor tras verificar el pago).
grant select on public.events to authenticated;
grant insert (owner_id, slug, type, title, event_date, rsvp_deadline, timezone, locale, content, theme, template)
  on public.events to authenticated;
grant update (title, event_date, rsvp_deadline, timezone, locale, content, theme, template)
  on public.events to authenticated;

drop policy if exists events_select_own on public.events;
create policy events_select_own on public.events
  for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists events_insert_own on public.events;
create policy events_insert_own on public.events
  for insert to authenticated with check (owner_id = (select auth.uid()));

drop policy if exists events_update_own on public.events;
create policy events_update_own on public.events
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- guests: el dueño del evento administra la lista. Las respuestas (attending, etc.)
-- las escribe solo el servidor cuando el invitado confirma.
grant select, delete on public.guests to authenticated;
grant insert (event_id, name, passes, phone, language) on public.guests to authenticated;
grant update (name, passes, phone, language) on public.guests to authenticated;

drop policy if exists guests_owner_all on public.guests;
create policy guests_owner_all on public.guests
  for all to authenticated
  using (exists (
    select 1 from public.events e
    where e.id = guests.event_id and e.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.events e
    where e.id = guests.event_id and e.owner_id = (select auth.uid())
  ));

commit;

-- Para hacerte superadmin después de iniciar sesión por primera vez con tu correo:
--   update public.profiles set is_superadmin = true where email = 'tu@correo.com';
-- Para asignarte como dueño de la boda:
--   update public.events set owner_id = (select id from public.profiles where email = 'tu@correo.com')
--   where slug = 'illian-y-alfredo';

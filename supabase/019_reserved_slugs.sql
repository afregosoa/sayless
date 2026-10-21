-- Migración 019: más direcciones reservadas para eventos.
-- Pegar en Supabase > SQL Editor > Run. Idempotente. Requiere 001.
--
-- Las rutas estáticas de la app (/plantillas, /registro, /recuperar, /restablecer, /terminos) tienen prioridad sobre /<evento>:
-- si alguien creara un evento con una de esas direcciones, su invitación nunca se podría abrir. Se reservan.

begin;

alter table public.events drop constraint if exists events_slug_reserved;
alter table public.events add constraint events_slug_reserved check (slug not in
  ('app', 'admin', 'api', 'login', 'auth', 'invitacion', 'static', 'www', 'precios', 'contacto',
   'plantillas', 'registro', 'recuperar', 'restablecer', 'terminos'));

commit;

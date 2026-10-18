-- Migración 002: el código de invitado pasa a ser único por evento (no global).
-- Pegar en Supabase > SQL Editor > Run. Idempotente.

begin;

alter table public.guests drop constraint if exists guests_code_key;
alter table public.guests drop constraint if exists guests_event_id_code_key;
alter table public.guests add constraint guests_event_id_code_key unique (event_id, code);

-- El título del hero ahora respeta saltos de línea (antes estaba fijo en el código).
update public.events
set content = jsonb_set(content, '{hero,title}', to_jsonb(E'Illian &\nAlfredo'::text))
where slug = 'illian-y-alfredo';

commit;

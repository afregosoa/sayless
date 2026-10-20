-- Evento de PRUEBA para sayless-dev (datos ficticios). NO correr en producción.
-- Pegar en Supabase > SQL Editor > Run. Se puede correr varias veces: reinicia el evento y sus invitados.
-- Requiere haber corrido schema.sql y las migraciones 001–010 (y 011 si usarás música).
--
-- ANTES DE CORRER: cambia el correo de abajo por el correo con el que inicias sesión en la app (sayless-dev).
-- Debes haber entrado al menos una vez (para que exista tu perfil); si no, el evento se crea sin dueño y
-- puedes asignarlo después desde /admin.
--
-- Invitación:  /ana-y-luis        Invitado con código:  /ana-y-luis/FAM001

do $seed$
declare
  v_owner_email constant text := 'tu-correo@ejemplo.com';   -- <<<<<< CAMBIA ESTO
  v_owner uuid;
  v_event uuid;
begin
  select id into v_owner from public.profiles where lower(email) = lower(v_owner_email);
  if v_owner is null then
    raise notice 'No hay perfil con el correo %. El evento se crea sin dueño (asígnalo desde /admin).', v_owner_email;
  end if;

  insert into public.events (owner_id, slug, type, title, status, event_date, rsvp_deadline, paid_at, content, theme)
  values (
    v_owner, 'ana-y-luis', 'boda', 'Ana & Luis (prueba)', 'published',
    '2027-06-12', '2027-05-10', now(),
    $json$
    {
      "hero": { "title": "Ana & Luis", "date_label": "12 de junio 2027", "subtitle": "Colima, México" },
      "welcome": {
        "enabled": true,
        "eyebrow": "Estás invitado",
        "heading": "Celebra con",
        "heading_script": "nosotros",
        "body": "Con mucha alegría queremos invitarte a compartir el día en que unimos nuestras vidas. Confirma tu asistencia con el código de tu invitación.",
        "quote": "Tu compañía hará ese día aún más especial."
      },
      "countdown": { "enabled": true, "date_label": "Sábado 12 de junio de 2027" },
      "venues": {
        "enabled": true,
        "eyebrow": "Sábado 12 de junio de 2027",
        "items": [
          { "label": "Ceremonia", "name": "Parroquia de Prueba", "time": "5:00 PM", "address": "Centro, Colima, Col.", "map_query": "Catedral Colima" },
          { "label": "Recepción", "name": "Jardín Los Cedros", "time": "7:00 PM", "address": "Colima, Col.", "map_query": "Jardin Colima" }
        ]
      },
      "schedule": {
        "enabled": true,
        "items": [
          { "time": "5:00 PM", "label": "Ceremonia" },
          { "time": "7:00 PM", "label": "Recepción y cóctel" },
          { "time": "8:30 PM", "label": "Cena" },
          { "time": "9:30 PM", "label": "Primer baile" },
          { "time": "10:00 PM", "label": "Fiesta" }
        ]
      },
      "dress_code": {
        "enabled": true,
        "body": "Formal. Te recomendamos calzado cómodo: la recepción es en jardín.",
        "quote": "Lo más importante es que te sientas increíble y listo para celebrar."
      },
      "gifts": {
        "enabled": true,
        "body": "Tenerte cerca es nuestro mejor regalo. Si deseas tener un detalle con nosotros, aquí está nuestra mesa de regalos.",
        "button_label": "Ver mesa de regalos",
        "url": "https://example.com/mesa-de-regalos"
      },
      "lodging": {
        "enabled": true,
        "items": [
          { "name": "Hotel de Prueba", "address": "Centro · a 10 minutos del jardín" }
        ]
      },
      "faq": {
        "enabled": true,
        "items": [
          { "q": "¿Puedo llevar acompañante?", "a": "Tu invitación indica los pases asignados. Por espacio, solo podemos recibir a las personas incluidas en ella." },
          { "q": "¿Pueden ir niños?", "a": "Sí, serán bienvenidos." },
          { "q": "¿Hasta cuándo puedo confirmar?", "a": "Hasta el 10 de mayo de 2027. Puedes cambiar tu respuesta con tu mismo código antes de esa fecha." }
        ]
      },
      "footer": { "monogram": "A | L", "line": "12 · 06 · 2027 · Colima" }
    }
    $json$::jsonb,
    $json$
    {
      "hero_art": "volcanes-colima",
      "light": { "paper": "#ECEBE4", "ink": "#22241F", "muted": "#62655B", "accent": "#55623F", "line": "#CBCBBF", "card": "#E3E2D9" },
      "dark":  { "paper": "#161814", "ink": "#E9E8E0", "muted": "#A5A89C", "accent": "#AFBD93", "line": "#34372F", "card": "#1E211B" }
    }
    $json$::jsonb
  )
  on conflict (slug) do update
    set owner_id = excluded.owner_id,
        type = excluded.type,
        title = excluded.title,
        status = excluded.status,
        event_date = excluded.event_date,
        rsvp_deadline = excluded.rsvp_deadline,
        paid_at = excluded.paid_at,
        content = excluded.content,
        theme = excluded.theme
  returning id into v_event;

  -- Invitados de prueba: unos sin responder, otros confirmados o que no asistirán, y uno en inglés.
  delete from public.guests where event_id = v_event;

  insert into public.guests (event_id, code, name, passes, phone, language, attending, confirmed_count, message, confirmed_at)
  values
    (v_event, 'FAM001', 'Familia Pérez',    4, '+523121110001', 'es', null,  null, null, null),
    (v_event, 'FAM002', 'Familia Ramírez',  3, '+523121110002', 'es', true,  3,    '¡Ahí estaremos, felicidades!', now() - interval '2 days'),
    (v_event, 'AMI001', 'Sofía Hernández',  2, '+523121110003', 'es', true,  1,    'Voy solita, gracias por invitarme.', now() - interval '1 day'),
    (v_event, 'AMI002', 'Carlos Medina',    2, '+523121110004', 'es', false, 0,    'No podré acompañarlos, mucha felicidad.', now() - interval '3 days'),
    (v_event, 'AMI003', 'Daniela Ortiz',    1, '+523121110005', 'es', null,  null, null, null),
    (v_event, 'USA001', 'John & Emily Carter', 2, '+15551230006', 'en', true, 2,   'Cannot wait to celebrate with you!', now() - interval '12 hours');

  raise notice 'Evento de prueba listo: /ana-y-luis  (id %)', v_event;
end
$seed$;

-- Evento de PRUEBA para sayless-dev (datos ficticios). NO correr en producción.
-- Pegar en Supabase > SQL Editor > Run. Se puede correr varias veces: reinicia el evento y sus invitados.
-- Requiere haber corrido schema.sql y las migraciones 001–021 (la 011 solo si usarás música).
--
-- ANTES DE CORRER: cambia el correo de abajo por el correo con el que inicias sesión en la app (sayless-dev).
-- Debes haber entrado al menos una vez (para que exista tu perfil); si no, el evento se crea sin dueño y
-- puedes asignarlo después desde /admin.
--
-- Invitación:  /ana-y-luis. Cada invitado recibe un código aleatorio: al final se muestran en los avisos (Messages) del SQL Editor,
-- o consúltalos con:  select name, code from public.guests where event_id = (select id from public.events where slug = 'ana-y-luis');

do $seed$
declare
  v_owner_email constant text := 'tu-correo@ejemplo.com';   -- <<<<<< CAMBIA ESTO
  v_owner uuid;
  v_event uuid;
  v_row record;
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
      "footer": { "monogram": "A | L", "line": "12 · 06 · 2027 · Colima" },
      "rsvp": { "ask_diet": true }
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

  -- Invitados de prueba. La base de datos crea una persona por pase (sin nombre) y recalcula solo los resúmenes
  -- (attending y confirmed_count) a partir de ellas; por eso las respuestas se cargan sobre las personas.
  delete from public.guests where event_id = v_event;

  -- Sin código: la base de datos genera uno aleatorio por invitación (al final se muestran en un aviso).
  insert into public.guests (event_id, name, passes, phone, language)
  values
    (v_event, 'Familia Pérez',       4, '+523121110001', 'es'),
    (v_event, 'Familia Ramírez',     3, '+523121110002', 'es'),
    (v_event, 'Sofía Hernández',     2, '+523121110003', 'es'),
    (v_event, 'Carlos Medina',       2, '+523121110004', 'es'),
    (v_event, 'Daniela Ortiz',       1, '+523121110005', 'es'),
    (v_event, 'John & Emily Carter', 2, '+15551230006',  'en');

  -- Familia Pérez: 4 personas con nombre, sin responder todavía.
  update public.guest_members m set name = x.name
  from (values (1, 'Ana Pérez'), (2, 'Luis Pérez'), (3, 'Sofía Pérez'), (4, 'Mateo Pérez')) as x(pos, name),
       public.guests g
  where g.event_id = v_event and g.name = 'Familia Pérez' and m.guest_id = g.id and m.position = x.pos;

  -- Familia Ramírez: confirmó 2 de 3 (la tercera persona no asiste).
  update public.guest_members m set name = x.name, attending = x.att
  from (values (1, 'Roberto Ramírez', true), (2, 'Elena Ramírez', true), (3, 'Camila Ramírez', false)) as x(pos, name, att),
       public.guests g
  where g.event_id = v_event and g.name = 'Familia Ramírez' and m.guest_id = g.id and m.position = x.pos;

  -- Sofía: vendrá sola (la segunda persona sin nombre no asiste).
  update public.guest_members m set name = case when m.position = 1 then 'Sofía Hernández' end, attending = (m.position = 1)
  from public.guests g where g.event_id = v_event and g.name = 'Sofía Hernández' and m.guest_id = g.id;

  -- Carlos: no podrá asistir.
  update public.guest_members m set attending = false
  from public.guests g where g.event_id = v_event and g.name = 'Carlos Medina' and m.guest_id = g.id;

  -- Los Carter: confirmaron los dos.
  update public.guest_members m set name = x.name, attending = true
  from (values (1, 'John Carter'), (2, 'Emily Carter')) as x(pos, name),
       public.guests g
  where g.event_id = v_event and g.name = 'John & Emily Carter' and m.guest_id = g.id and m.position = x.pos;

  -- Alimentación y alergias de ejemplo (requiere la migración 018).
  update public.guest_members m set diet = array['vegetarian'], allergies = 'Nueces'
  from public.guests g where g.event_id = v_event and g.name = 'Familia Pérez' and m.guest_id = g.id and m.position = 2;
  update public.guest_members m set diet = array['gluten_free', 'dairy_free']
  from public.guests g where g.event_id = v_event and g.name = 'Familia Ramírez' and m.guest_id = g.id and m.position = 1;
  update public.guest_members m set allergies = 'Mariscos'
  from public.guests g where g.event_id = v_event and g.name = 'John & Emily Carter' and m.guest_id = g.id and m.position = 2;

  -- Aperturas de ejemplo (requiere la migración 020): los Pérez abrieron su invitación y no han confirmado;
  -- Daniela aún no la abre; los Ramírez, Sofía y los Carter la abrieron antes de confirmar.
  update public.guests set first_opened_at = now() - interval '3 days', last_opened_at = now() - interval '5 hours', open_count = 4
    where event_id = v_event and name = 'Familia Pérez';
  update public.guests set first_opened_at = now() - interval '4 days', last_opened_at = now() - interval '2 days', open_count = 2
    where event_id = v_event and name in ('Familia Ramírez', 'Sofía Hernández', 'John & Emily Carter');
  update public.guests set first_opened_at = now() - interval '6 days', last_opened_at = now() - interval '6 days', open_count = 1
    where event_id = v_event and name = 'Carlos Medina';

  -- Avisos de ejemplo (requiere la migración 021): a los Pérez se les envió la invitación y un recordatorio.
  delete from public.guest_contacts where event_id = v_event;
  insert into public.guest_contacts (event_id, guest_id, kind, created_at)
  select v_event, g.id, 'invitacion', now() - interval '6 days' from public.guests g where g.event_id = v_event and g.name <> 'Daniela Ortiz';
  insert into public.guest_contacts (event_id, guest_id, kind, created_at)
  select v_event, g.id, 'vieron', now() - interval '1 day' from public.guests g where g.event_id = v_event and g.name = 'Familia Pérez';

  -- Mensajes y fechas de respuesta (no los toca el recálculo).
  update public.guests set message = '¡Ahí estaremos, felicidades!', confirmed_at = now() - interval '2 days' where event_id = v_event and name = 'Familia Ramírez';
  update public.guests set message = 'Voy solita, gracias por invitarme.', confirmed_at = now() - interval '1 day' where event_id = v_event and name = 'Sofía Hernández';
  update public.guests set message = 'No podré acompañarlos, mucha felicidad.', confirmed_at = now() - interval '3 days' where event_id = v_event and name = 'Carlos Medina';
  update public.guests set message = 'Cannot wait to celebrate with you!', confirmed_at = now() - interval '12 hours' where event_id = v_event and name = 'John & Emily Carter';

  raise notice 'Evento de prueba listo: /ana-y-luis  (id %)', v_event;
  for v_row in select name, code from public.guests where event_id = v_event order by name loop
    raise notice 'Invitación % -> /ana-y-luis/%', v_row.name, v_row.code;
  end loop;
end
$seed$;

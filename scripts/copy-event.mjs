// Copia UNA invitación de un proyecto de Supabase a otro (por ejemplo, de desarrollo a producción):
// la fila del evento (textos, plantilla, colores, fecha) y sus fotos y su canción. No copia invitados ni confirmaciones.
//
// Uso (primero sin --apply, solo muestra qué haría):
//   SRC_URL=... SRC_KEY=... DST_URL=... DST_KEY=... \
//   node scripts/copy-event.mjs <slug-origen> <correo-del-dueño-en-destino> [--new-slug=otro-slug] [--apply]
//
// SRC_* / DST_* son la URL del proyecto y la clave service_role de cada uno. Las claves dan acceso total:
// pásalas solo por variables de entorno en tu computadora; nunca las pegues en el código ni las subas a git.
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")));
const [slug, ownerEmail] = args.filter((a) => !a.startsWith("--"));
const apply = "apply" in flags;
const newSlug = flags["new-slug"] ?? slug;
const { SRC_URL, SRC_KEY, DST_URL, DST_KEY } = process.env;

if (!slug || !ownerEmail?.includes("@")) {
  console.error("Uso: node scripts/copy-event.mjs <slug-origen> <correo-del-dueño> [--new-slug=x] [--apply]");
  process.exit(1);
}
if (!SRC_URL || !SRC_KEY || !DST_URL || !DST_KEY) {
  console.error("Faltan SRC_URL, SRC_KEY, DST_URL o DST_KEY.");
  process.exit(1);
}
if (SRC_URL === DST_URL) {
  console.error("Origen y destino son el mismo proyecto: no hay nada que copiar.");
  process.exit(1);
}

const opts = { auth: { persistSession: false } };
const src = createClient(SRC_URL, SRC_KEY, opts);
const dst = createClient(DST_URL, DST_KEY, opts);
const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };

// 1. Evento de origen
const { data: ev, error: evErr } = await src.from("events").select("*").eq("slug", slug).maybeSingle();
if (evErr) fail(`No se pudo leer el evento: ${evErr.message}`);
if (!ev) fail(`No existe un evento con la dirección «${slug}» en el origen.`);

// 2. ¿La dirección ya está en uso en destino?
const { data: taken } = await dst.from("events").select("id").eq("slug", newSlug).maybeSingle();
if (taken) fail(`La dirección «${newSlug}» ya existe en destino. Usa --new-slug=otra-direccion.`);

// 3. Archivos que referencia el contenido
const content = ev.content ?? {};
const media = [content.hero?.image, ...(content.gallery?.items ?? []).map((i) => i?.path), ...(content.venues?.items ?? []).map((i) => i?.image), content.gifts?.image].filter(Boolean);
const audio = content.music?.path ? [content.music.path] : [];
const files = [
  ...media.map((path) => ({ bucket: "event-media", path })),
  ...audio.map((path) => ({ bucket: "event-audio", path })),
];

const newId = randomUUID();
const newPath = (path) => `${newId}/${path.split("/").slice(1).join("/")}`;

console.log(`Evento: «${ev.title}» (${ev.slug}) → «${newSlug}», dueño ${ownerEmail}`);
console.log(`Plantilla: ${ev.template} · Fotos: ${media.length} · Canción: ${audio.length}`);
if (!apply) {
  console.log("\nSimulación: no se escribió nada. Agrega --apply para copiar de verdad.");
  process.exit(0);
}

// 4. Copiar archivos (si algo falla, se detiene antes de crear el evento)
const copied = [];
try {
  for (const f of files) {
    const { data, error } = await src.storage.from(f.bucket).download(f.path);
    if (error) throw new Error(`No se pudo descargar ${f.bucket}/${f.path}: ${error.message}`);
    const to = newPath(f.path);
    const { error: upErr } = await dst.storage.from(f.bucket).upload(to, data, { contentType: data.type, upsert: false });
    if (upErr) throw new Error(`No se pudo subir ${f.bucket}/${to}: ${upErr.message}`);
    copied.push({ bucket: f.bucket, path: to });
    console.log(`  ✓ ${f.bucket}/${to}`);
  }
} catch (e) {
  for (const c of copied) await dst.storage.from(c.bucket).remove([c.path]);
  fail(`${e.message}\nSe borraron los archivos ya copiados; no se creó el evento.`);
}

// 5. Reescribir las rutas del contenido para que apunten a las carpetas del evento nuevo
let json = JSON.stringify(content);
for (const f of files) json = json.split(JSON.stringify(f.path).slice(1, -1)).join(newPath(f.path));

// 6. Dueño: si ya tiene cuenta en destino se le asigna; si no, queda reservado hasta su primer inicio de sesión
const { data: profile } = await dst.from("profiles").select("id").eq("email", ownerEmail.toLowerCase()).maybeSingle();

const { error: insErr } = await dst.from("events").insert({
  id: newId,
  owner_id: profile?.id ?? null,
  slug: newSlug,
  type: ev.type,
  title: ev.title,
  status: "draft", // se publica a mano en producción
  template: ev.template,
  event_date: ev.event_date,
  rsvp_deadline: ev.rsvp_deadline,
  timezone: ev.timezone,
  locale: ev.locale,
  content: JSON.parse(json),
  theme: ev.theme,
});
if (insErr) {
  for (const c of copied) await dst.storage.from(c.bucket).remove([c.path]);
  fail(`No se pudo crear el evento: ${insErr.message}\nSe borraron los archivos copiados.`);
}
if (!profile) await dst.from("owner_invites").insert({ email: ownerEmail.toLowerCase(), event_id: newId });

console.log(`\n✓ Listo. Evento ${newId} creado en destino como borrador.`);
console.log(profile ? "  Asignado a la cuenta existente." : `  ${ownerEmail} lo recibirá al iniciar sesión por primera vez.`);

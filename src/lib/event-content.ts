import { z } from "zod";

// Todo lo que el cliente puede editar. Cada sección es opcional: si falta o tiene
// enabled=false, no se muestra. Los textos se renderizan siempre como texto (nunca HTML).
export const MAX_GALLERY = 10;
const str = (max: number) => z.string().max(max).default("");
const flag = z.boolean().default(true);
const httpUrl = z.url({ protocol: /^https?$/ }).max(500);
// Solo rutas de nuestro bucket (<event_id>/<uuid>.webp): nunca URLs externas arbitrarias.
const MEDIA_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/;
const mediaPath = z.string().regex(MEDIA_PATH);
// Música: <event_id>/<uuid>.mp3 en el bucket de audio.
const AUDIO_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.mp3$/;
const audioPath = z.string().regex(AUDIO_PATH);

export const contentSchema = z.object({
  hero: z.object({
    title: str(120),
    date_label: str(80),
    subtitle: str(80),
    image: mediaPath.optional(),
    image_alt: str(160),
  }).default({ title: "", date_label: "", subtitle: "", image_alt: "" }),
  welcome: z.object({
    enabled: flag, eyebrow: str(80), heading: str(120), heading_script: str(60),
    body: str(1200), quote: str(400),
  }).optional(),
  gallery: z.object({
    enabled: flag,
    items: z.array(z.object({ path: mediaPath, alt: str(160) })).max(MAX_GALLERY).default([]),
  }).optional(),
  countdown: z.object({ enabled: flag, date_label: str(80) }).optional(),
  venues: z.object({
    enabled: flag, eyebrow: str(80),
    items: z.array(z.object({
      label: str(80), name: str(120), time: str(40), address: str(200), map_query: str(200),
    })).max(6).default([]),
  }).optional(),
  schedule: z.object({
    enabled: flag,
    items: z.array(z.object({ time: str(40), label: str(160) })).max(30).default([]),
  }).optional(),
  dress_code: z.object({ enabled: flag, body: str(800), quote: str(400) }).optional(),
  gifts: z.object({
    enabled: flag, body: str(800), button_label: str(60), url: httpUrl.optional(),
  }).optional(),
  lodging: z.object({
    enabled: flag,
    items: z.array(z.object({ name: str(120), address: str(200) })).max(10).default([]),
  }).optional(),
  faq: z.object({
    enabled: flag,
    items: z.array(z.object({ q: str(200), a: str(1200) })).max(20).default([]),
  }).optional(),
  footer: z.object({ monogram: str(20), line: str(120) }).optional(),
  // Confirmación de asistencia: ¿se pregunta alimentación y alergias? (datos de salud: solo si el anfitrión lo activa)
  rsvp: z.object({ ask_diet: z.boolean().default(false) }).optional(),
  // El cliente sube su propio MP3 y declara tener derecho a usarlo (ver /terminos).
  music: z.object({
    enabled: flag,
    path: audioPath.optional(),
    title: str(120),
    button_label: str(40), // texto del botón de la portada; vacío = "Reproduce nuestra canción"
    cover: flag, // pantalla "Toca para abrir": el navegador exige un toque para reproducir audio
    start: z.number().min(0).max(3600).optional(), // segundo en que empieza (saltar la introducción)
    end: z.number().min(0).max(3600).optional(),   // segundo en que termina y vuelve a empezar (opcional)
    rights_accepted: z.boolean().default(false),
    accepted_at: z.string().max(40).optional(), // lo fija el servidor al guardar
  }).optional(),
});

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const palette = z.object({
  paper: color, ink: color, muted: color, accent: color, line: color, card: color,
}).partial();

export const themeSchema = z.object({
  hero_art: z.string().max(40).optional(),
  light: palette.optional(),
  dark: palette.optional(),
});

export type EventContent = z.infer<typeof contentSchema>;
export type EventTheme = z.infer<typeof themeSchema>;

// Los colores ya están validados como #RRGGBB, así que es seguro inyectarlos en un <style>.
export function themeCss(theme: EventTheme): string {
  const vars = (p?: Record<string, string | undefined>) =>
    Object.entries(p ?? {}).filter(([, v]) => v).map(([k, v]) => `--${k}:${v}`).join(";");
  const light = vars(theme.light);
  const dark = vars(theme.dark);
  return [
    light && `:root{${light}}`,
    dark && `@media (prefers-color-scheme: dark){:root{${dark}}}`,
  ].filter(Boolean).join("\n");
}

// ── Fechas ──
export function formatDay(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(`${iso}T00:00:00Z`));
}

function offsetMs(utc: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
  }).formatToParts(new Date(utc));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - utc;
}

/** Instante UTC (ms) en que empieza `isoDate` (YYYY-MM-DD) en la zona horaria dada. */
export function zonedMidnightUtc(isoDate: string, timeZone: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const first = guess - offsetMs(guess, timeZone);
  return guess - offsetMs(first, timeZone);
}

// ── Fotos ──
export const MEDIA_BUCKET = "event-media";
export const AUDIO_BUCKET = "event-audio";

export function audioUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${AUDIO_BUCKET}/${path}`;
}

export function isMediaPath(path: string) {
  return MEDIA_PATH.test(path);
}

export function mediaUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

/** Todas las fotos que referencia un contenido (portada + galería). */
export function mediaPaths(content: EventContent): string[] {
  return [content.hero.image, ...(content.gallery?.items.map((i) => i.path) ?? [])].filter(
    (p): p is string => !!p,
  );
}

/** Suma días a una fecha ISO (YYYY-MM-DD) sin problemas de zona horaria. */
export function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

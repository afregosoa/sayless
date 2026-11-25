import { MusicPlayer } from "@/components/music-player";
import { Rsvp } from "@/components/rsvp";
import { audioUrl, mediaUrl } from "@/lib/event-content";
import type { TemplateProps } from "./types";

/** ¿La sección existe y está activada? */
export const on = <T extends { enabled: boolean }>(section: T | undefined): section is T => !!section && section.enabled;

/** Texto con saltos de línea (\n) -> <br> */
export function Lines({ text }: { text: string }) {
  return text.split("\n").map((line, i) => (
    <span key={i}>{i > 0 && <br />}{line}</span>
  ));
}

// Enlaces de Google Maps (incluidos los cortos al compartir): se abren tal cual en lugar de buscarlos.
const MAPS_HOSTS = /^(www\.)?(google\.[a-z.]+|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl|g\.page)$/i;
function mapsLink(text: string): string | null {
  try {
    const u = new URL(text.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!MAPS_HOSTS.test(u.hostname)) return null;
    // google.com/algo solo cuenta si es /maps...; los cortos (goo.gl, g.page, maps.app.goo.gl) se aceptan completos.
    if (/^(www\.)?google\./i.test(u.hostname) && !u.pathname.startsWith("/maps")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export const mapsHref = (query: string) =>
  mapsLink(query) ?? `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query })}`;

/** Foto de portada (o la de muestra en el catálogo). */
export const heroImage = (event: TemplateProps["event"]) =>
  event.demo?.hero ?? (event.content.hero.image ? mediaUrl(event.content.hero.image) : null);

/** Fotos de la galería (o las de muestra en el catálogo). */
export const galleryImages = (event: TemplateProps["event"]): { src: string; alt: string }[] =>
  event.demo?.gallery
    ? event.demo.gallery.map((src, i) => ({ src, alt: `Foto de muestra ${i + 1}` }))
    : (event.content.gallery?.enabled ? event.content.gallery.items : []).map((i) => ({ src: mediaUrl(i.path), alt: i.alt }));

/** Título público de la invitación en una sola línea (sin saltos). */
export const flatTitle = (event: TemplateProps["event"]) => (event.content.hero.title || event.title).replace(/\s*\n\s*/g, " ").trim();

/** Reproductor de música (si el evento tiene). `cover` apaga la pantalla de apertura propia, para plantillas con su propia apertura. `autoOnScroll` empieza la canción al desplazarse (sujeto a lo que permita el navegador). */
export function MusicSlot({ event, preview, cover, autoOnScroll }: { event: TemplateProps["event"]; preview?: boolean; cover?: boolean; autoOnScroll?: boolean }) {
  const m = event.content.music;
  if (!on(m) || !m.path) return null;
  return (
    <MusicPlayer
      src={audioUrl(m.path)}
      title={m.title}
      label={m.button_label}
      cover={cover ?? m.cover}
      start={m.start}
      end={m.end}
      eventTitle={event.content.hero.title || event.title}
      preview={preview}
      autoOnScroll={autoOnScroll}
    />
  );
}

/** Confirmación de asistencia. El estilo del formulario lo da el contenedor de cada plantilla. */
export function RsvpSlot({ event, code, guest }: Pick<TemplateProps, "event" | "code" | "guest">) {
  return (
    <Rsvp
      slug={event.slug}
      initialCode={code}
      initialGuest={guest}
      calendar={event.calendar}
      deadlineLabel={event.deadlineLabel}
      closed={event.status === "closed"}
      askDiet={!!event.content.rsvp?.ask_diet}
      demo={!!event.demo}
    />
  );
}

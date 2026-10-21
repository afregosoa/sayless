import "server-only";
import { cache } from "react";
import { buildCalendarData, type CalendarData } from "./calendar";
import { isTemplateId, type TemplateId } from "@/templates/catalog";
import {
  contentSchema, themeSchema, formatDay, zonedMidnightUtc,
  type EventContent, type EventTheme,
} from "./event-content";
import { supabaseAdmin } from "./supabase-server";

export type PublicEvent = {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published" | "closed";
  locale: string;
  template: TemplateId;
  content: EventContent;
  theme: EventTheme;
  countdownTarget: number | null;
  deadlineLabel: string | null;
  calendar: CalendarData | null; // para "Agregar al calendario" (Google y .ics)
  /** Solo en las vistas de muestra del catálogo (/plantillas/<id>): imágenes locales y sin guardado real. */
  demo?: { hero?: string; gallery?: string[] };
};

export const EVENT_COLUMNS =
  "id, slug, title, status, locale, template, timezone, event_date, rsvp_deadline, content, theme";

type EventRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  locale: string;
  template: string | null;
  timezone: string;
  event_date: string | null;
  rsvp_deadline: string | null;
  content: unknown;
  theme: unknown;
};

/** Convierte una fila de `events` en lo que necesita la invitación. Null si el contenido es inválido. */
export function buildPublicEvent(row: EventRow): PublicEvent | null {
  const content = contentSchema.safeParse(row.content);
  const theme = themeSchema.safeParse(row.theme);
  if (!content.success || !theme.success) {
    console.error(`Evento "${row.slug}" con contenido inválido`, content.error ?? theme.error);
    return null;
  }
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status as PublicEvent["status"],
    locale: row.locale,
    template: isTemplateId(row.template) ? row.template : "editorial", // una plantilla desconocida cae en la clásica
    content: content.data,
    theme: theme.data,
    countdownTarget: row.event_date ? zonedMidnightUtc(row.event_date, row.timezone) : null,
    deadlineLabel: row.rsvp_deadline ? formatDay(row.rsvp_deadline, row.locale) : null,
    calendar: row.event_date
      ? buildCalendarData({
          id: row.id,
          // El título público de la invitación (sin saltos de línea); si falta, el nombre interno del evento.
          title: (content.data.hero.title || row.title).replace(/\s*\n\s*/g, " ").trim(),
          eventDate: row.event_date,
          midnightUtc: zonedMidnightUtc(row.event_date, row.timezone),
          content: content.data,
        })
      : null,
  };
}

/** Evento visible al público (publicado o cerrado). Los borradores devuelven null. */
export const getPublicEvent = cache(async (slug: string): Promise<PublicEvent | null> => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;

  const { data } = await supabaseAdmin()
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("slug", slug)
    .in("status", ["published", "closed"])
    .maybeSingle();
  return data ? buildPublicEvent(data) : null;
});

/**
 * Por qué una invitación no se puede mostrar. Solo devuelve el estado, nunca datos del evento.
 *  - "draft": existe pero aún no está publicada.
 *  - "unreadable": está publicada, pero su contenido no se puede leer.
 *  - "missing": no existe ninguna con esa dirección.
 */
export const getUnavailableReason = cache(async (slug: string): Promise<"draft" | "unreadable" | "missing"> => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return "missing";
  const { data } = await supabaseAdmin().from("events").select("status").eq("slug", slug).maybeSingle();
  if (!data) return "missing";
  return data.status === "draft" ? "draft" : "unreadable";
});

// Temporal: el panel /admin aún opera sobre un solo evento (el primero). La fase 3 lo reemplaza.
export async function defaultEvent(): Promise<{ id: string; slug: string }> {
  const { data, error } = await supabaseAdmin()
    .from("events")
    .select("id, slug")
    .order("created_at")
    .limit(1)
    .single();
  if (error || !data) throw new Error("No hay eventos. Ejecuta supabase/001_events.sql");
  return data;
}

export async function defaultEventId() {
  return (await defaultEvent()).id;
}

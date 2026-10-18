import "server-only";
import { cache } from "react";
import {
  contentSchema, themeSchema, formatDay, zonedMidnightUtc, googleCalendarUrl,
  type EventContent, type EventTheme,
} from "./event-content";
import { supabaseAdmin } from "./supabase-server";

export type PublicEvent = {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published" | "closed";
  locale: string;
  content: EventContent;
  theme: EventTheme;
  countdownTarget: number | null;
  deadlineLabel: string | null;
  calendarUrl: string | null;
};

export const EVENT_COLUMNS =
  "id, slug, title, status, locale, timezone, event_date, rsvp_deadline, content, theme";

type EventRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  locale: string;
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
  const location = content.data.venues?.items[0]?.address ?? "";
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status as PublicEvent["status"],
    locale: row.locale,
    content: content.data,
    theme: theme.data,
    countdownTarget: row.event_date ? zonedMidnightUtc(row.event_date, row.timezone) : null,
    deadlineLabel: row.rsvp_deadline ? formatDay(row.rsvp_deadline, row.locale) : null,
    calendarUrl: row.event_date ? googleCalendarUrl(row.title, row.event_date, location) : null,
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

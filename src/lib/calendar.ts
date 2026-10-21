// "Agregar al calendario": convierte los datos de la invitación en un evento de calendario (Google y archivo .ics).
// Funciones puras: sirven en el servidor (archivo .ics) y en el navegador (enlace de Google).
import type { EventContent } from "./event-content";

/** Datos serializables del evento de calendario (los milisegundos son instantes UTC). */
export type CalendarData = {
  uid: string;
  title: string;
  date: string;            // YYYY-MM-DD, el día del evento en su zona horaria
  startUtc: number | null; // null = evento de todo el día
  endUtc: number | null;
  location: string;
  description: string;     // sin el enlace de la invitación: lo agrega quien conoce el dominio
};

const HOUR = 3_600_000;
const MIN = 60_000;

/**
 * "6:00 PM", "6pm", "18:00", "18 hrs", "6 de la tarde" -> minutos desde medianoche. Null si no parece una hora.
 * Es texto libre que escribe el cliente, así que cualquier cosa que no se entienda se ignora.
 */
export function parseTimeOfDay(text: string): number | null {
  const t = text.toLowerCase().replace(/\./g, "").replace(/\b([ap]) m\b/g, "$1m").replace(/\s+/g, " ").trim(); // "p. m." -> "pm"
  const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm|hrs?|h\b)?/.exec(t);
  if (!m) return null;
  let hour = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (min > 59 || hour > 23) return null;
  const meridiem = m[3] === "am" || m[3] === "pm" ? m[3] : /de la (tarde|noche)/.test(t) ? "pm" : /de la mañana/.test(t) ? "am" : null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
  } else if (!m[2] && !m[3]) {
    return null; // un número suelto ("2027", "3") no es una hora
  }
  return hour * 60 + min;
}

const addDay = (isoDate: string) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

type Input = {
  id: string;
  title: string;
  eventDate: string;
  midnightUtc: number; // instante UTC en que empieza ese día en la zona horaria del evento
  content: EventContent;
};

export function buildCalendarData({ id, title, eventDate, midnightUtc, content }: Input): CalendarData {
  const venues = content.venues?.items ?? [];
  const schedule = content.schedule?.enabled ? content.schedule.items : [];

  // Hora de inicio: la del primer lugar con hora legible; si no, la primera del itinerario.
  const venueTimes = venues.map((v) => parseTimeOfDay(v.time)).filter((x): x is number => x !== null);
  const scheduleTimes = schedule.map((s) => parseTimeOfDay(s.time)).filter((x): x is number => x !== null);
  const startMin = venueTimes[0] ?? scheduleTimes[0] ?? null;

  let startUtc: number | null = null;
  let endUtc: number | null = null;
  if (startMin !== null) {
    startUtc = midnightUtc + startMin * MIN;
    // Fin: dos horas después de la última actividad del itinerario; si no hay, seis horas desde el inicio.
    const last = scheduleTimes.length ? Math.max(...scheduleTimes) : null;
    const byLast = last !== null && last > startMin ? midnightUtc + last * MIN + 2 * HOUR : null;
    endUtc = Math.min(byLast ?? startUtc + 6 * HOUR, startUtc + 14 * HOUR);
    if (endUtc <= startUtc) endUtc = startUtc + 3 * HOUR;
  }

  const first = venues[0];
  const location = first ? [first.name, first.address].filter(Boolean).join(", ") : "";

  const lines: string[] = [];
  const places = venues.filter((v) => v.name);
  if (places.length) {
    lines.push("Lugares:");
    for (const v of places) {
      lines.push(`- ${[v.label, v.time].filter(Boolean).join(" · ") || "Lugar"}: ${[v.name, v.address].filter(Boolean).join(", ")}`);
    }
  }
  const acts = schedule.filter((s) => s.label);
  if (acts.length) {
    if (lines.length) lines.push("");
    lines.push("Itinerario:");
    for (const s of acts) lines.push(`${s.time ? `${s.time} · ` : ""}${s.label}`);
  }

  return { uid: `${id}@sayless`, title, date: eventDate, startUtc, endUtc, location, description: lines.join("\n") };
}

// ── Formatos ──
const utcStamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const dayStamp = (isoDate: string) => isoDate.replaceAll("-", "");

/** Enlace "Agregar a Google Calendar". `inviteUrl` es la dirección de la invitación (se agrega a la descripción). */
export function googleCalendarLink(ev: CalendarData, inviteUrl?: string): string {
  const dates = ev.startUtc !== null && ev.endUtc !== null
    ? `${utcStamp(ev.startUtc)}/${utcStamp(ev.endUtc)}`
    : `${dayStamp(ev.date)}/${dayStamp(addDay(ev.date))}`;
  const details = [ev.description, inviteUrl ? `Invitación: ${inviteUrl}` : ""].filter(Boolean).join("\n\n").slice(0, 1800);
  const q = new URLSearchParams({ action: "TEMPLATE", text: ev.title, dates, details, location: ev.location });
  return `https://calendar.google.com/calendar/render?${q}`;
}

// RFC 5545: \ ; , y saltos de línea se escapan, y cada línea se pliega a 75 octetos (UTF-8) con un espacio de continuación.
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let curBytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (curBytes + b > limit) {
      out.push(cur);
      cur = ch;
      curBytes = b;
      limit = 74; // las líneas de continuación llevan un espacio al inicio
    } else {
      cur += ch;
      curBytes += b;
    }
  }
  out.push(cur);
  return out.join("\r\n ");
}

/** Archivo .ics (iCalendar) para Apple Calendar, Outlook y demás. Incluye recordatorios 1 día y 2 horas antes. */
export function icsFile(ev: CalendarData, inviteUrl?: string, now: Date = new Date()): string {
  const allDay = ev.startUtc === null || ev.endUtc === null;
  const description = [ev.description, inviteUrl ? `Invitación: ${inviteUrl}` : ""].filter(Boolean).join("\n\n");
  const alarm = (trigger: string, text: string) => [
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(text)}`, `TRIGGER:${trigger}`, "END:VALARM",
  ];
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sayless//Invitaciones//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(ev.title)}`,
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `DTSTAMP:${utcStamp(now.getTime())}`,
    allDay ? `DTSTART;VALUE=DATE:${dayStamp(ev.date)}` : `DTSTART:${utcStamp(ev.startUtc!)}`,
    allDay ? `DTEND;VALUE=DATE:${dayStamp(addDay(ev.date))}` : `DTEND:${utcStamp(ev.endUtc!)}`,
    `SUMMARY:${esc(ev.title)}`,
    ...(ev.location ? [`LOCATION:${esc(ev.location)}`] : []),
    ...(description ? [`DESCRIPTION:${esc(description)}`] : []),
    ...(inviteUrl ? [`URL:${inviteUrl}`] : []),
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    ...alarm("-P1D", `Mañana: ${ev.title}`),
    ...(allDay ? [] : alarm("-PT2H", `En dos horas: ${ev.title}`)),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

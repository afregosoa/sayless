// Modo guiado de recordatorios: a quién avisar, con qué mensaje y cómo abrir el chat de WhatsApp.
// Nada se envía solo: el anfitrión pulsa enviar en WhatsApp y luego confirma que lo envió.

export const SEGMENTS = ["por_invitar", "vieron", "sin_abrir", "pendientes"] as const;
export type Segment = (typeof SEGMENTS)[number];

export const SEGMENT_LABELS: Record<Segment, string> = {
  por_invitar: "Invitaciones por enviar",
  vieron: "Vieron su invitación y no confirmaron",
  sin_abrir: "Aún no abren su invitación",
  pendientes: "Todos los que no han confirmado",
};

/** Lo que se registra en guest_contacts (la invitación inicial se llama "invitacion"). */
export const segmentKind = (s: Segment) => (s === "por_invitar" ? "invitacion" : s);

export const DEFAULT_TEMPLATES: Record<Segment, string> = {
  por_invitar: "Hola {nombre}, te invitamos a {evento}. Aquí está tu invitación y el link para confirmar tu asistencia: {enlace}",
  vieron: "Hola {nombre}, ¿nos confirmas tu asistencia a {evento}{limite}? Solo toma un minuto: {enlace}",
  sin_abrir: "Hola {nombre}, te compartimos de nuevo tu invitación a {evento}. Ahí encuentras los detalles y puedes confirmar tu asistencia: {enlace}",
  pendientes: "Hola {nombre}, te recordamos confirmar tu asistencia a {evento}{limite}: {enlace}",
};

export const TEMPLATE_VARS = ["{nombre}", "{evento}", "{enlace}", "{limite}"] as const;

/** Rellena las variables. {limite} queda como " antes del 10 de mayo" (o vacío si no hay fecha límite). */
export function fillTemplate(tpl: string, v: { nombre: string; evento: string; enlace: string; limite: string | null }): string {
  return tpl
    .replaceAll("{nombre}", v.nombre)
    .replaceAll("{evento}", v.evento)
    .replaceAll("{enlace}", v.enlace)
    .replaceAll("{limite}", v.limite ? ` antes del ${v.limite}` : "");
}

/** Solo dígitos (wa.me no acepta "+", espacios ni guiones). */
export const waDigits = (phone: string | null | undefined) => (phone ?? "").replace(/\D/g, "");

/** Un teléfono con menos de 11 dígitos casi seguro no trae la lada del país (en México: +52). */
export const phoneLooksIncomplete = (phone: string | null | undefined) => waDigits(phone).length < 11;

export const waLink = (phone: string, text: string) => `https://wa.me/${waDigits(phone)}?text=${encodeURIComponent(text)}`;

export type QueueGuest = {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  attending: boolean | null;
  openCount: number;
  lastOpenedAt: string | null;
  contactCount: number;
  lastContactAt: string | null;
};

/** ¿Pertenece este invitado a la lista de ese grupo? Solo cuentan quienes aún no responden. */
export function inSegment(g: QueueGuest, s: Segment): boolean {
  if (g.attending !== null) return false;
  switch (s) {
    case "por_invitar": return g.contactCount === 0;
    case "vieron": return g.openCount > 0;
    case "sin_abrir": return g.openCount === 0;
    case "pendientes": return true;
  }
}

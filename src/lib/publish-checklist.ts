import type { EventContent } from "./event-content";

export type CheckItem = { id: string; label: string; done: boolean; required: boolean };

// Textos de ejemplo del tipo "[Hotel 1]" o "[Nombre del lugar]".
const PLACEHOLDER = /\[[^\]]*\]/;

function countPlaceholders(value: unknown): number {
  if (typeof value === "string") return PLACEHOLDER.test(value) ? 1 : 0;
  if (Array.isArray(value)) return value.reduce<number>((n, v) => n + countPlaceholders(v), 0);
  if (value && typeof value === "object") {
    return Object.values(value).reduce<number>((n, v) => n + countPlaceholders(v), 0);
  }
  return 0;
}

/**
 * Qué falta antes de publicar. Los `required` bloquean la publicación; el resto son recomendaciones.
 * Es función pura para reutilizarla en el servidor (por ejemplo, al validar el pago).
 */
export function publishChecklist(input: {
  eventDate: string | null;
  rsvpDeadline: string | null;
  content: EventContent;
  guestCount: number;
}): CheckItem[] {
  const { content: c } = input;
  const placeholders = countPlaceholders(c);
  const venuesOk = !c.venues?.enabled || c.venues.items.some((v) => v.name.trim() && !PLACEHOLDER.test(v.name));

  return [
    { id: "date", label: "Define la fecha del evento", done: !!input.eventDate, required: true },
    { id: "title", label: "Escribe el título de la portada", done: !!c.hero.title.trim(), required: true },
    {
      id: "placeholders",
      label: placeholders
        ? `Reemplaza ${placeholders} ${placeholders === 1 ? "texto de ejemplo" : "textos de ejemplo"} (los que dicen [así])`
        : "Sin textos de ejemplo pendientes",
      done: placeholders === 0,
      required: true,
    },
    { id: "venue", label: "Agrega al menos un lugar con nombre", done: venuesOk, required: true },
    { id: "deadline", label: "Define la fecha límite para confirmar", done: !!input.rsvpDeadline, required: false },
    { id: "guests", label: "Carga a tus invitados", done: input.guestCount > 0, required: false },
    { id: "photo", label: "Agrega una foto de portada", done: !!c.hero.image, required: false },
  ];
}

export const isReadyToPublish = (items: CheckItem[]) => items.every((i) => i.done || !i.required);

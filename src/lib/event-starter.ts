import type { EventContent, EventTheme } from "./event-content";

export const EVENT_TYPES = ["boda", "xv", "bautizo", "cumpleanos", "otro"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  boda: "Boda",
  xv: "XV años",
  bautizo: "Bautizo",
  cumpleanos: "Cumpleaños",
  otro: "Otro evento",
};

export function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const DEFAULT_THEME: EventTheme = {
  light: { paper: "#ECEBE4", ink: "#22241F", muted: "#62655B", accent: "#55623F", line: "#CBCBBF", card: "#E3E2D9" },
  dark: { paper: "#161814", ink: "#E9E8E0", muted: "#A5A89C", accent: "#AFBD93", line: "#34372F", card: "#1E211B" },
};

/** Contenido inicial de un evento nuevo: el cliente lo edita después. */
export function starterContent(title: string, type: EventType): EventContent {
  const celebracion = type === "boda" ? "nuestra boda" : "nuestra celebración";
  return {
    hero: { title, date_label: "", subtitle: "", image_alt: "" },
    welcome: {
      enabled: true,
      eyebrow: "Estás invitado",
      heading: "Celebra con",
      heading_script: "nosotros",
      body: `Nos encantaría contar contigo en ${celebracion}. Confirma tu asistencia con el código de tu invitación.`,
      quote: "",
    },
    gallery: { enabled: false, items: [] },
    countdown: { enabled: true, date_label: "" },
    venues: {
      enabled: true,
      eyebrow: "",
      items: [{ label: "Lugar", name: "[Nombre del lugar]", time: "", address: "", map_query: "" }],
    },
    schedule: { enabled: false, items: [] },
    dress_code: { enabled: false, body: "", quote: "" },
    gifts: { enabled: false, body: "", button_label: "Ver mesa de regalos" },
    lodging: { enabled: false, items: [] },
    faq: { enabled: false, items: [] },
  };
}

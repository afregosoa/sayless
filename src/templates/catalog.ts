// Catálogo de plantillas: solo datos (sin componentes), para poder usarlo también en el navegador (selector del editor).
// Cada plantilla es un diseño completo sobre los mismos datos de la invitación; el cliente puede cambiar sus colores.
import type { EventType } from "@/lib/event-starter";
import type { EventTheme } from "@/lib/event-content";

export const TEMPLATE_IDS = ["editorial", "sobre", "jardin", "moderno"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export type TemplateInfo = {
  id: TemplateId;
  name: string;
  tagline: string;
  eventTypes: EventType[];
  /** Colores y detalles iniciales; el cliente los puede cambiar en el editor. */
  theme: EventTheme;
  /** Cómo es, en pocas palabras (se muestra en el catálogo). */
  traits: string[];
};

const palette = (light: Record<string, string>, dark: Record<string, string>): EventTheme => ({ light, dark });

export const TEMPLATES: Record<TemplateId, TemplateInfo> = {
  editorial: {
    id: "editorial",
    name: "Editorial",
    tagline: "Sobria y elegante, con la silueta de los volcanes de Colima",
    eventTypes: ["boda", "xv", "bautizo", "cumpleanos", "otro"],
    traits: ["Una sola columna", "Tipografía clásica", "Verde olivo"],
    theme: {
      hero_art: "volcanes-colima",
      ...palette(
        { paper: "#ECEBE4", ink: "#22241F", muted: "#62655B", accent: "#55623F", line: "#CBCBBF", card: "#E3E2D9" },
        { paper: "#161814", ink: "#E9E8E0", muted: "#A5A89C", accent: "#AFBD93", line: "#34372F", card: "#1E211B" },
      ),
    },
  },
  sobre: {
    id: "sobre",
    name: "Sobre y sello",
    tagline: "Un sobre que se abre con un sello de lacre y revela la invitación",
    eventTypes: ["boda"],
    traits: ["Animación de sobre", "Dorado y rosa", "Caligrafía romántica"],
    theme: palette(
      { paper: "#F6EFE6", ink: "#3B2C2C", muted: "#8A766D", accent: "#A9824A", line: "#E2D3C1", card: "#FBF6EF" },
      { paper: "#1E1816", ink: "#F1E7DC", muted: "#B9A79B", accent: "#D6B26E", line: "#3A302B", card: "#271F1C" },
    ),
  },
  jardin: {
    id: "jardin",
    name: "Jardín",
    tagline: "Arcos, ramas y hojas en verde salvia: una boda al aire libre",
    eventTypes: ["boda"],
    traits: ["Ilustración botánica", "Fotos en arco", "Verde salvia"],
    theme: palette(
      { paper: "#F3F0E8", ink: "#2B3A2E", muted: "#6B7A6C", accent: "#5E8A68", line: "#D5D9CB", card: "#E9EDE1" },
      { paper: "#131A15", ink: "#E8EEE4", muted: "#9FB0A0", accent: "#8DBB98", line: "#2A372D", card: "#1B251E" },
    ),
  },
  moderno: {
    id: "moderno",
    name: "Moderno",
    tagline: "Tipografía grande, mucho contraste y un toque de color vivo",
    eventTypes: ["boda"],
    traits: ["Portada a pantalla completa", "Secciones numeradas", "Naranja vivo"],
    theme: palette(
      { paper: "#FAFAF7", ink: "#111111", muted: "#6A6A66", accent: "#FF4F1F", line: "#DADAD4", card: "#F0F0EA" },
      { paper: "#0E0E0E", ink: "#F4F4F0", muted: "#9A9A94", accent: "#FF6B3D", line: "#2A2A28", card: "#181817" },
    ),
  },
};

export const isTemplateId = (v: unknown): v is TemplateId => typeof v === "string" && (TEMPLATE_IDS as readonly string[]).includes(v);

/** Plantillas disponibles para un tipo de evento (las de "otro" tipo no se ofrecen para bodas y viceversa). */
export function templatesFor(type: EventType): TemplateInfo[] {
  return TEMPLATE_IDS.map((id) => TEMPLATES[id]).filter((t) => t.eventTypes.includes(type));
}

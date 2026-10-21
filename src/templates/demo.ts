// Evento de muestra para el catálogo de plantillas (/plantillas/<id>): datos de ejemplo, sin base de datos.
import { buildCalendarData } from "@/lib/calendar";
import { contentSchema } from "@/lib/event-content";
import type { Guest } from "@/lib/rsvp-schema";
import type { PublicEvent } from "@/lib/events";
import { TEMPLATES, type TemplateId } from "./catalog";

const DATE = "2027-06-12";

const content = contentSchema.parse({
  hero: { title: "Ana & Luis", date_label: "12 de junio de 2027", subtitle: "Colima, México", image_alt: "Ana y Luis" },
  welcome: {
    enabled: true, eyebrow: "Nos casamos", heading: "Celebra con", heading_script: "nosotros",
    body: "Con mucha alegría queremos invitarte a compartir el día en que unimos nuestras vidas. Tu presencia hará ese día aún más especial.",
    quote: "El amor no consiste en mirarse el uno al otro, sino en mirar juntos en la misma dirección.",
  },
  countdown: { enabled: true, date_label: "Sábado 12 de junio de 2027" },
  venues: {
    enabled: true, eyebrow: "Sábado 12 de junio de 2027",
    items: [
      { label: "Ceremonia", name: "Parroquia de San Felipe", time: "5:00 PM", address: "Centro, Colima, Col.", map_query: "Catedral Colima" },
      { label: "Recepción", name: "Jardín Los Cedros", time: "7:00 PM", address: "Camino Real 120, Colima, Col.", map_query: "Jardin Colima" },
    ],
  },
  schedule: {
    enabled: true,
    items: [
      { time: "5:00 PM", label: "Ceremonia" }, { time: "7:00 PM", label: "Recepción y cóctel" }, { time: "8:30 PM", label: "Cena" },
      { time: "9:30 PM", label: "Primer baile" }, { time: "10:00 PM", label: "Fiesta" },
    ],
  },
  dress_code: { enabled: true, body: "Formal. Te recomendamos calzado cómodo: la recepción es en jardín.", quote: "Lo más importante es que te sientas increíble y listo para celebrar." },
  gifts: { enabled: true, body: "Tenerte cerca es nuestro mejor regalo. Si deseas tener un detalle con nosotros, aquí está nuestra mesa de regalos.", button_label: "Ver mesa de regalos", url: "https://example.com" },
  lodging: { enabled: true, items: [{ name: "Hotel Centro Histórico", address: "A 10 minutos del jardín" }, { name: "Posada del Volcán", address: "A 15 minutos del jardín" }] },
  faq: {
    enabled: true,
    items: [
      { q: "¿Puedo llevar acompañante?", a: "Tu invitación indica los pases asignados. Por espacio, solo podemos recibir a las personas incluidas en ella." },
      { q: "¿Pueden ir niños?", a: "Sí, serán bienvenidos." },
      { q: "¿Hasta cuándo puedo confirmar?", a: "Hasta el 10 de mayo de 2027." },
    ],
  },
  footer: { monogram: "A | L", line: "12 · 06 · 2027 · Colima" },
  rsvp: { ask_diet: true },
});

export const demoGuest: Guest = {
  name: "Familia Pérez", passes: 3, attending: null, confirmedCount: null, message: null,
  members: [
    { id: "d1", name: "Ana Pérez", attending: null, diet: [], allergies: null },
    { id: "d2", name: "Luis Pérez", attending: null, diet: [], allergies: null },
    { id: "d3", name: null, attending: null, diet: [], allergies: null },
  ],
};

export function demoEvent(id: TemplateId): PublicEvent {
  const t = TEMPLATES[id];
  return {
    id: `demo-${id}`, slug: `demo-${id}`, title: "Ana & Luis", status: "published", locale: "es", template: id,
    content, theme: t.theme,
    countdownTarget: Date.UTC(2027, 5, 12, 23, 0, 0), // fija: Next no permite Date.now() al pre-renderizar
    deadlineLabel: "10 de mayo",
    calendar: null,
    demo: {
      hero: `/templates/demo-hero-${id}.svg`,
      gallery: [1, 2, 3, 4].map((n) => `/templates/demo-photo-${n}.svg`),
    },
  };
}
// (el contenido se exporta para que el catálogo pueda mostrar los mismos textos)
export const demoContent = content;
export const demoCalendarFor = (id: string) => buildCalendarData({ id, title: "Ana & Luis", eventDate: DATE, midnightUtc: Date.UTC(2027, 5, 12, 6), content });

import type { PublicEvent } from "@/lib/events";
import type { Guest } from "@/lib/rsvp-schema";

/** Lo que recibe cada plantilla: los mismos datos, para que el editor, el RSVP, la música y el calendario funcionen con todas. */
export type TemplateProps = { event: PublicEvent; code?: string; guest?: Guest; preview?: boolean };

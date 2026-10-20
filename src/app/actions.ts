"use server";

import { getPublicEvent } from "@/lib/events";
import { findGuest, RateLimitedError } from "@/lib/guests";
import { rsvpSchema, type Guest } from "@/lib/rsvp-schema";
import { supabaseAdmin } from "@/lib/supabase-server";

const RATE_LIMITED_MESSAGE = "Demasiados intentos con códigos incorrectos. Espera unos minutos e intenta de nuevo.";

/** Devuelve la invitación, null si el código no existe, o "limitado" si esa dirección ya falló demasiadas veces. */
export async function lookupGuest(slug: string, code: string): Promise<Guest | null | "limitado"> {
  const event = await getPublicEvent(slug);
  if (!event) return null;
  let guest;
  try {
    guest = await findGuest(event.id, code);
  } catch (e) {
    if (e instanceof RateLimitedError) return "limitado";
    throw e;
  }
  if (!guest) return null;
  const { name, passes, attending, confirmedCount, message, members } = guest;
  return { name, passes, attending, confirmedCount, message, members };
}

export async function submitRsvp(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = rsvpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa los datos del formulario." };

  const { slug, code, members, message } = parsed.data;
  const event = await getPublicEvent(slug);
  if (!event) return { ok: false, error: "Evento no encontrado." };
  if (event.status === "closed") return { ok: false, error: "La confirmación de asistencia ya cerró." };

  let guest;
  try {
    guest = await findGuest(event.id, code);
  } catch (e) {
    if (e instanceof RateLimitedError) return { ok: false, error: RATE_LIMITED_MESSAGE };
    throw e;
  }
  if (!guest) return { ok: false, error: "Invitación no encontrada." };

  // Deben venir exactamente las personas de esta invitación, ni más ni menos.
  const ids = new Set(guest.members.map((m) => m.id));
  if (members.length !== ids.size || members.some((m) => !ids.has(m.id)) || new Set(members.map((m) => m.id)).size !== ids.size) {
    return { ok: false, error: "La invitación cambió. Recarga la página e intenta de nuevo." };
  }
  if (members.some((m) => m.attending && !m.name)) {
    return { ok: false, error: "Escribe el nombre de cada persona que asistirá." };
  }

  // service_role: el invitado no tiene sesión. Un trigger de la base de datos recalcula attending y confirmed_count.
  const db = supabaseAdmin();
  const results = await Promise.all(
    members.map((m) =>
      db.from("guest_members")
        .update({ name: m.name || null, attending: m.attending })
        .eq("id", m.id)
        .eq("guest_id", guest.id),
    ),
  );
  if (results.some((r) => r.error)) return { ok: false, error: "No pudimos guardar tu respuesta. Intenta de nuevo." };

  const { error } = await db
    .from("guests")
    .update({ message: message || null, confirmed_at: new Date().toISOString() })
    .eq("id", guest.id);
  if (error) return { ok: false, error: "No pudimos guardar tu respuesta. Intenta de nuevo." };

  return { ok: true };
}

"use server";

import { getPublicEvent } from "@/lib/events";
import { findGuest } from "@/lib/guests";
import { rsvpSchema, type Guest } from "@/lib/rsvp-schema";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function lookupGuest(slug: string, code: string): Promise<Guest | null> {
  const event = await getPublicEvent(slug);
  if (!event) return null;
  const guest = await findGuest(event.id, code);
  if (!guest) return null;
  const { name, passes, attending, confirmedCount, message } = guest;
  return { name, passes, attending, confirmedCount, message };
}

export async function submitRsvp(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = rsvpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa los datos del formulario." };

  const { slug, code, attending, confirmedCount, message } = parsed.data;
  const event = await getPublicEvent(slug);
  if (!event) return { ok: false, error: "Evento no encontrado." };
  if (event.status === "closed") return { ok: false, error: "La confirmación de asistencia ya cerró." };

  const guest = await findGuest(event.id, code);
  if (!guest) return { ok: false, error: "Invitación no encontrada." };

  const count = attending ? confirmedCount : 0;
  if (attending && (count < 1 || count > guest.passes)) {
    return { ok: false, error: `Puedes confirmar entre 1 y ${guest.passes} personas.` };
  }

  const { error } = await supabaseAdmin()
    .from("guests")
    .update({
      attending,
      confirmed_count: count,
      message: message || null,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", guest.id);
  if (error) return { ok: false, error: "No pudimos guardar tu respuesta. Intenta de nuevo." };

  return { ok: true };
}

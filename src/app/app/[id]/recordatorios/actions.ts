"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseUser } from "@/lib/supabase/server";

export type ContactResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  eventId: z.uuid(),
  guestId: z.uuid(),
  kind: z.enum(["invitacion", "sin_abrir", "vieron", "pendientes"]),
});

/** El anfitrión confirma que ya envió el mensaje a este invitado. Con su sesión: RLS solo deja registrar en eventos que puede editar. */
export async function logContact(input: unknown): Promise<ContactResult> {
  await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const supabase = await supabaseUser();
  const { error } = await supabase.from("guest_contacts").insert({
    event_id: parsed.data.eventId,
    guest_id: parsed.data.guestId,
    kind: parsed.data.kind,
  });
  if (error?.code === "23514") return { ok: false, error: "Ese invitado no pertenece a este evento." };
  if (error) return { ok: false, error: "No se pudo registrar el aviso." };

  revalidatePath(`/app/${parsed.data.eventId}`);
  return { ok: true };
}

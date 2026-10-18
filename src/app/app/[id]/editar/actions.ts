"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { contentSchema, mediaPaths, MEDIA_BUCKET, themeSchema } from "@/lib/event-content";
import { supabaseUser } from "@/lib/supabase/server";

export type SaveResult = { ok: true } | { ok: false; error: string };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

const payloadSchema = z.object({
  title: z.string().trim().min(2).max(120),
  eventDate: isoDate,
  rsvpDeadline: isoDate,
  content: contentSchema,
  theme: themeSchema,
});

export async function saveEvent(eventId: string, input: unknown): Promise<SaveResult> {
  await requireUser();
  if (!z.uuid().safeParse(eventId).success) return { ok: false, error: "Evento inválido." };

  // Se valida TODO en el servidor: lo que llegue del navegador no es de fiar.
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `Revisa el campo "${issue.path.join(" › ")}": ${issue.message}` };
  }
  const { title, eventDate, rsvpDeadline, content, theme } = parsed.data;

  // Las fotos referenciadas deben vivir en la carpeta de ESTE evento.
  const referenced = mediaPaths(content);
  if (referenced.some((p) => !p.startsWith(`${eventId}/`))) {
    return { ok: false, error: "Hay una foto que no pertenece a este evento." };
  }

  // Con la sesión del usuario: RLS solo permite editar eventos propios, y los GRANT de
  // columnas impiden tocar status, pago o slug.
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from("events")
    .update({ title, event_date: eventDate, rsvp_deadline: rsvpDeadline, content, theme })
    .eq("id", eventId)
    .select("id, slug");
  if (error) return { ok: false, error: "No se pudo guardar. Intenta de nuevo." };
  if (!data?.length) return { ok: false, error: "No tienes permiso para editar este evento." };

  await removeOrphanImages(supabase, eventId, referenced);

  revalidatePath(`/${data[0].slug}`);
  revalidatePath(`/app/${eventId}`);
  return { ok: true };
}

// Borra fotos subidas que ya no se usan. Se respeta un margen de 10 minutos para no tocar
// una foto recién subida desde otra pestaña que todavía no se guardó.
async function removeOrphanImages(
  supabase: Awaited<ReturnType<typeof supabaseUser>>,
  eventId: string,
  referenced: string[],
) {
  const { data: files } = await supabase.storage.from(MEDIA_BUCKET).list(eventId, { limit: 100 });
  const keep = new Set(referenced);
  const cutoff = Date.now() - 10 * 60 * 1000;
  const stale = (files ?? [])
    .filter((f) => !keep.has(`${eventId}/${f.name}`) && f.created_at && new Date(f.created_at).getTime() < cutoff)
    .map((f) => `${eventId}/${f.name}`);
  if (stale.length) await supabase.storage.from(MEDIA_BUCKET).remove(stale);
}

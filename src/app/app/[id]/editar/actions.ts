"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { AUDIO_BUCKET, contentSchema, mediaPaths, MEDIA_BUCKET, themeSchema } from "@/lib/event-content";
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
  const user = await requireUser();
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

  // Música: el MP3 debe ser de este evento y el cliente debe haber declarado que tiene derecho a usarlo.
  // La fecha de aceptación la fija el servidor (no el navegador) y queda en el registro de actividad.
  let newRightsAcceptance: string | null = null;
  const music = content.music;
  if (music?.path) {
    if (!music.path.startsWith(`${eventId}/`)) return { ok: false, error: "Hay una canción que no pertenece a este evento." };
    if (music.end != null && music.end <= (music.start ?? 0)) {
      return { ok: false, error: "En la música, el final debe ser después del inicio." };
    }
    if (!music.rights_accepted) return { ok: false, error: "Para usar música debes aceptar la declaración de derechos." };
    const { data: current } = await supabase.from("events").select("content").eq("id", eventId).maybeSingle();
    const prev = (current?.content as { music?: { path?: string; accepted_at?: string } } | null)?.music;
    if (prev?.path === music.path && prev.accepted_at) {
      music.accepted_at = prev.accepted_at;
    } else {
      music.accepted_at = new Date().toISOString();
      newRightsAcceptance = music.path;
    }
  } else if (music) {
    music.rights_accepted = false;
    delete music.accepted_at;
  }

  const { data, error } = await supabase
    .from("events")
    .update({ title, event_date: eventDate, rsvp_deadline: rsvpDeadline, content, theme })
    .eq("id", eventId)
    .select("id, slug");
  if (error) return { ok: false, error: "No se pudo guardar. Intenta de nuevo." };
  if (!data?.length) return { ok: false, error: "No tienes permiso para editar este evento." };

  await removeOrphanFiles(supabase, MEDIA_BUCKET, eventId, referenced);
  await removeOrphanFiles(supabase, AUDIO_BUCKET, eventId, music?.path ? [music.path] : []);
  if (newRightsAcceptance) await audit(user.id, eventId, "music_rights_accepted", { path: newRightsAcceptance });

  revalidatePath(`/${data[0].slug}`);
  revalidatePath(`/app/${eventId}`);
  return { ok: true };
}

// Borra archivos subidos (fotos o música) que ya no se usan. Se respeta un margen de 10 minutos para no tocar
// uno recién subido desde otra pestaña que todavía no se guardó.
async function removeOrphanFiles(
  supabase: Awaited<ReturnType<typeof supabaseUser>>,
  bucket: string,
  eventId: string,
  referenced: string[],
) {
  const { data: files } = await supabase.storage.from(bucket).list(eventId, { limit: 100 });
  const keep = new Set(referenced);
  const cutoff = Date.now() - 10 * 60 * 1000;
  const stale = (files ?? [])
    .filter((f) => !keep.has(`${eventId}/${f.name}`) && f.created_at && new Date(f.created_at).getTime() < cutoff)
    .map((f) => `${eventId}/${f.name}`);
  if (stale.length) await supabase.storage.from(bucket).remove(stale);
}

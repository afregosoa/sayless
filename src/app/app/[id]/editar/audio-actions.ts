"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { MAX_AUDIO_BYTES } from "@/lib/audio-limits";
import { AUDIO_BUCKET } from "@/lib/event-content";
import { supabaseUser } from "@/lib/supabase/server";

export type AudioUploadResult = { ok: true; path: string } | { ok: false; error: string };

const MAX_FILES_PER_EVENT = 3; // el actual + reemplazos aún no limpiados

// Un MP3 empieza con una etiqueta ID3 o con una cabecera de trama (11 bits en 1).
function looksLikeMp3(head: Uint8Array) {
  if (head.length < 3) return false;
  if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) return true; // "ID3"
  return head[0] === 0xff && (head[1] & 0xe0) === 0xe0;
}

/**
 * Recibe el MP3 que sube el cliente. El tipo declarado no es de fiar, así que se revisa el contenido,
 * y la política de Storage (con la sesión del usuario) solo deja escribir en carpetas de eventos editables.
 * La declaración de derechos se exige y se registra al guardar el evento (saveEvent).
 */
export async function uploadEventAudio(eventId: string, formData: FormData): Promise<AudioUploadResult> {
  await requireUser();
  if (!z.uuid().safeParse(eventId).success) return { ok: false, error: "Evento inválido." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Selecciona un archivo MP3." };
  if (file.size > MAX_AUDIO_BYTES) {
    return { ok: false, error: "El archivo pesa más de 4 MB (unos 4 minutos). Comprímelo o recórtalo e intenta de nuevo." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikeMp3(bytes)) return { ok: false, error: "Ese archivo no es un MP3 válido." };

  const supabase = await supabaseUser();
  const { data: existing, error: listError } = await supabase.storage
    .from(AUDIO_BUCKET)
    .list(eventId, { limit: MAX_FILES_PER_EVENT + 1 });
  if (listError) return { ok: false, error: "No se pudo subir la música." };
  if ((existing?.length ?? 0) >= MAX_FILES_PER_EVENT) {
    return { ok: false, error: "Guarda tus cambios antes de subir otra canción." };
  }

  const path = `${eventId}/${randomUUID()}.mp3`;
  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(path, bytes, { contentType: "audio/mpeg", cacheControl: "31536000", upsert: false });
  if (error) return { ok: false, error: "No se pudo subir la música. ¿Es tu evento?" };

  return { ok: true, path };
}

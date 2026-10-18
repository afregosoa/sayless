"use server";

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { MEDIA_BUCKET } from "@/lib/event-content";
import { supabaseUser } from "@/lib/supabase/server";

export type UploadResult = { ok: true; path: string } | { ok: false; error: string };

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // las funciones de Vercel limitan la petición a ~4.5 MB; el navegador ya reduce la foto
const MAX_FILES_PER_EVENT = 20; // incluye fotos aún no guardadas en el contenido
const MAX_PIXELS = 60_000_000; // protege contra imágenes "bomba"

/**
 * Recibe una foto, la valida, quita metadatos (incluida la ubicación GPS), la orienta,
 * la reduce a 2000 px y la guarda como WebP en la carpeta del evento.
 */
export async function uploadEventImage(eventId: string, formData: FormData): Promise<UploadResult> {
  await requireUser();
  if (!z.uuid().safeParse(eventId).success) return { ok: false, error: "Evento inválido." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Selecciona una foto." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "La foto pesa más de 4 MB. Prueba con una más pequeña." };

  let webp: Buffer;
  try {
    // Se decodifica de verdad: si no es una imagen válida, sharp falla (no se confía en el tipo declarado).
    webp = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: MAX_PIXELS })
      .rotate() // respeta la orientación EXIF; la salida ya no lleva metadatos
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return { ok: false, error: "No pudimos leer esa imagen. Usa JPG, PNG o WebP." };
  }

  // Con la sesión del usuario: las políticas de Storage solo permiten escribir en carpetas de eventos propios.
  const supabase = await supabaseUser();
  const { data: existing, error: listError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .list(eventId, { limit: MAX_FILES_PER_EVENT + 1 });
  if (listError) return { ok: false, error: "No se pudo subir la foto." };
  if ((existing?.length ?? 0) >= MAX_FILES_PER_EVENT) {
    return { ok: false, error: "Llegaste al límite de fotos de este evento." };
  }

  const path = `${eventId}/${randomUUID()}.webp`;
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, webp, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (error) return { ok: false, error: "No se pudo subir la foto. ¿Es tu evento?" };

  return { ok: true, path };
}

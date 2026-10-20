import "server-only";
import { codeSchema, type Guest } from "./rsvp-schema";
import { clientKey, isBlocked, recordFailure } from "./rate-limit";
import { supabaseAdmin } from "./supabase-server";

// Intentos fallidos de código permitidos por dirección y ventana. Un invitado real casi nunca falla; quien prueba códigos, sí.
const MAX_FAILED_CODES = 10;
const WINDOW_SECONDS = 600;

export class RateLimitedError extends Error {}

export async function findGuest(
  eventId: string,
  rawCode: string,
): Promise<(Guest & { id: string }) | null> {
  const key = await clientKey("codigo");
  if (await isBlocked(key, MAX_FAILED_CODES, WINDOW_SECONDS)) throw new RateLimitedError();

  const parsed = codeSchema.safeParse(rawCode);
  if (!parsed.success) {
    await recordFailure(key, WINDOW_SECONDS);
    return null;
  }

  // El código es alfanumérico (validado), así que ilike no admite comodines.
  const { data } = await supabaseAdmin()
    .from("guests")
    .select("id, name, passes, attending, confirmed_count, message, anonymized_at")
    .eq("event_id", eventId)
    .ilike("code", parsed.data)
    .maybeSingle();
  if (!data || data.anonymized_at) {
    await recordFailure(key, WINDOW_SECONDS); // datos ya eliminados o código inexistente: cuenta como intento fallido
    return null;
  }

  const { data: members } = await supabaseAdmin()
    .from("guest_members")
    .select("id, name, attending")
    .eq("guest_id", data.id)
    .order("position");

  return {
    id: data.id,
    name: data.name,
    passes: data.passes,
    attending: data.attending,
    confirmedCount: data.confirmed_count,
    message: data.message,
    members: members ?? [],
  };
}

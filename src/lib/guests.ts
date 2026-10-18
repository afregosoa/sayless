import "server-only";
import { codeSchema, type Guest } from "./rsvp-schema";
import { supabaseAdmin } from "./supabase-server";

export async function findGuest(
  eventId: string,
  rawCode: string,
): Promise<(Guest & { id: string }) | null> {
  const parsed = codeSchema.safeParse(rawCode);
  if (!parsed.success) return null;

  // El código es alfanumérico (validado), así que ilike no admite comodines.
  const { data } = await supabaseAdmin()
    .from("guests")
    .select("id, name, passes, attending, confirmed_count, message, anonymized_at")
    .eq("event_id", eventId)
    .ilike("code", parsed.data)
    .maybeSingle();
  if (!data || data.anonymized_at) return null; // datos ya eliminados: la invitación deja de funcionar

  return {
    id: data.id,
    name: data.name,
    passes: data.passes,
    attending: data.attending,
    confirmedCount: data.confirmed_count,
    message: data.message,
  };
}

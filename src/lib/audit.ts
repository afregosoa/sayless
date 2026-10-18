import "server-only";
import { supabaseAdmin } from "./supabase-server";

type Details = Record<string, string | number | boolean | null>;

/** Registra una acción del operador (service_role: los usuarios no pueden escribir en el registro). */
export async function audit(actorId: string, eventId: string | null, action: string, details: Details = {}) {
  await supabaseAdmin().from("audit_log").insert({ actor_id: actorId, event_id: eventId, action, details });
}

/** Registra que el operador abrió un evento con acceso de soporte (una vez cada 10 minutos). */
export async function auditSupportView(actorId: string, eventId: string) {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data } = await db
    .from("audit_log")
    .select("id")
    .eq("actor_id", actorId)
    .eq("event_id", eventId)
    .eq("action", "support_view")
    .gt("at", since)
    .limit(1);
  if (!data?.length) await audit(actorId, eventId, "support_view");
}

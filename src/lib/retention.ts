import "server-only";
import { supabaseAdmin } from "./supabase-server";

export const RETENTION_DAYS = 90;

/** ¿Está encendido el borrado automático de datos de invitados? (apagado por defecto) */
export async function retentionEnabled(): Promise<boolean> {
  const { data } = await supabaseAdmin().from("app_settings").select("value").eq("key", "retention_enabled").maybeSingle();
  return data?.value === true;
}

import "server-only";
import { headers } from "next/headers";
import { supabaseAdmin } from "./supabase-server";

// Límite de intentos fallidos (migración 017). Si la base de datos no responde o la migración no está aplicada,
// NO se bloquea a nadie: un fallo del limitador nunca debe impedir que un invitado confirme.

/** Identifica al visitante por su dirección IP (Vercel la pone en estos encabezados). */
export async function clientKey(prefix: string) {
  const h = await headers();
  const ip =
    h.get("x-vercel-forwarded-for") ?? h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
  return `${prefix}:${ip}`;
}

export async function isBlocked(key: string, max: number, windowSeconds: number) {
  try {
    const { data } = await supabaseAdmin().rpc("rate_limit_count", { p_key: key, p_window_seconds: windowSeconds });
    return typeof data === "number" && data >= max;
  } catch {
    return false;
  }
}

export async function recordFailure(key: string, windowSeconds: number) {
  try {
    await supabaseAdmin().rpc("rate_limit_hit", { p_key: key, p_window_seconds: windowSeconds });
  } catch {
    /* ver nota arriba */
  }
}

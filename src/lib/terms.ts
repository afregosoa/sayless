import "server-only";
import { supabaseAdmin } from "./supabase-server";

/** Guarda cuándo aceptó los Términos de uso (solo la primera vez). Lo escribe el servidor: el usuario no puede editar su perfil. */
export async function recordTermsAcceptance(userId: string) {
  const { error } = await supabaseAdmin()
    .from("profiles")
    .update({ terms_accepted_at: new Date().toISOString() })
    .eq("id", userId)
    .is("terms_accepted_at", null);
  if (error) console.error("No se pudo registrar la aceptación de términos", error.message);
}

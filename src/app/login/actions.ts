"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseUser } from "@/lib/supabase/server";

export type LoginState = { sent?: string; error?: string };

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = z.email().max(200).safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { error: "Escribe un correo válido." };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const next = String(formData.get("next") ?? "");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  const supabase = await supabaseUser();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: {
      emailRedirectTo: `${proto}://${host}/auth/callback?next=${encodeURIComponent(safeNext)}`,
      shouldCreateUser: true,
    },
  });
  if (error) {
    return { error: error.status === 429 ? "Demasiados intentos. Espera unos minutos." : "No pudimos enviar el enlace. Intenta de nuevo." };
  }
  return { sent: email.data };
}

export async function signOut() {
  const supabase = await supabaseUser();
  await supabase.auth.signOut();
  redirect("/login");
}

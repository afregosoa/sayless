"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { siteUrl } from "@/lib/site-url";
import { recordTermsAcceptance } from "@/lib/terms";
import { supabaseUser } from "@/lib/supabase/server";

export type AuthState = { error?: string; sent?: string; confirm?: string };

const emailSchema = z.email().max(200);
// 72 es el máximo que admite bcrypt (lo que usa Supabase para guardar contraseñas).
const passwordSchema = z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(72, "La contraseña es demasiado larga (máx. 72).");

const EXISTS = "Ya existe una cuenta con ese correo. Entra con tu contraseña o recupérala.";

function readEmail(formData: FormData) {
  return emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
}

/** Solo rutas internas: evita que /login?next=https://sitio-malicioso.com sirva de redirección abierta. */
function safeNext(value: FormDataEntryValue | null) {
  const next = String(value ?? "");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

function authError(error: { code?: string; status?: number }): string {
  if (error.status === 429 || error.code === "over_request_rate_limit" || error.code === "over_email_send_rate_limit") {
    return "Demasiados intentos. Espera unos minutos.";
  }
  switch (error.code) {
    case "invalid_credentials": return "Correo o contraseña incorrectos.";
    case "email_not_confirmed": return "Confirma tu correo primero: te enviamos un enlace al registrarte.";
    case "user_already_exists":
    case "email_exists": return EXISTS;
    case "weak_password": return "Esa contraseña es muy débil. Usa al menos 8 caracteres, mezclando letras y números.";
    default: return "No pudimos completar la solicitud. Intenta de nuevo.";
  }
}

export async function signInWithPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = readEmail(formData);
  const password = String(formData.get("password") ?? "");
  if (!email.success || !password) return { error: "Escribe tu correo y tu contraseña." };

  const supabase = await supabaseUser();
  const { error } = await supabase.auth.signInWithPassword({ email: email.data, password });
  if (error) return { error: authError(error) };
  redirect(safeNext(formData.get("next")));
}

export async function signUpWithPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = z.string().trim().min(2, "Escribe tu nombre.").max(80, "El nombre es demasiado largo.").safeParse(formData.get("name") ?? "");
  if (!name.success) return { error: name.error.issues[0].message };
  const email = readEmail(formData);
  if (!email.success) return { error: "Escribe un correo válido." };
  const password = passwordSchema.safeParse(String(formData.get("password") ?? ""));
  if (!password.success) return { error: password.error.issues[0].message };

  // Teléfono opcional: si lo escriben, debe parecer un teléfono.
  const phone = String(formData.get("phone") ?? "").trim();
  if (phone && !/^\+?[\d\s().-]{7,20}$/.test(phone)) return { error: "Escribe un teléfono válido o déjalo vacío." };

  if (formData.get("terms") !== "on") return { error: "Debes aceptar los Términos de uso para crear tu cuenta." };

  const next = safeNext(formData.get("next"));
  const supabase = await supabaseUser();
  const { data, error } = await supabase.auth.signUp({
    email: email.data,
    password: password.data,
    options: {
      emailRedirectTo: `${await siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
      data: { full_name: name.data, ...(phone ? { phone } : {}) }, // el trigger de la base de datos los copia al perfil
    },
  });
  if (error) return { error: authError(error) };
  // Con "Confirm email" activo, Supabase no avisa que el correo ya existe: devuelve un usuario sin identidades.
  if (data.user && data.user.identities?.length === 0) return { error: EXISTS };
  if (data.user) await recordTermsAcceptance(data.user.id);
  if (data.session) redirect(next); // confirmación de correo desactivada: entra de inmediato
  return { confirm: email.data };
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get("next"));
  // terms=1: la persona marcó la casilla de Términos en el registro; el callback lo guarda al volver de Google.
  const terms = formData.get("terms") === "1" ? "&terms=1" : "";
  const supabase = await supabaseUser();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await siteUrl()}/auth/callback?next=${encodeURIComponent(next)}${terms}` },
  });
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}

export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = readEmail(formData);
  if (!email.success) return { error: "Escribe un correo válido." };

  const supabase = await supabaseUser();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${await siteUrl()}/auth/callback?next=${encodeURIComponent("/restablecer")}`,
  });
  if (error && (error.status === 429 || error.code?.startsWith("over_"))) return { error: authError(error) };
  // Misma respuesta exista o no la cuenta, para no revelar qué correos están registrados.
  return { sent: email.data };
}

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = passwordSchema.safeParse(String(formData.get("password") ?? ""));
  if (!password.success) return { error: password.error.issues[0].message };
  if (password.data !== String(formData.get("confirm") ?? "")) return { error: "Las contraseñas no coinciden." };

  const supabase = await supabaseUser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "El enlace expiró. Pide uno nuevo desde “Olvidé mi contraseña”." };
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: authError(error) };
  redirect("/app");
}

export async function signOut() {
  const supabase = await supabaseUser();
  await supabase.auth.signOut();
  redirect("/login");
}

// Herramienta SOLO para desarrollo local: genera un enlace de acceso sin enviar correo,
// para no toparse con el límite de correos de Supabase.
//
// Uso:  node --env-file=.env.local scripts/dev-login-link.mjs tu@correo.com [/ruta-destino]
//
// Usa la clave service_role, así que nunca debe ejecutarse ni exponerse fuera de tu computadora.
import { createClient } from "@supabase/supabase-js";

const [email, next = "/app"] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const site = process.env.DEV_SITE_URL ?? "http://localhost:3000";

if (process.env.NODE_ENV === "production") {
  console.error("Este script es solo para desarrollo.");
  process.exit(1);
}
if (!email || !email.includes("@")) {
  console.error("Uso: node --env-file=.env.local scripts/dev-login-link.mjs tu@correo.com [/ruta]");
  process.exit(1);
}
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await supabase.auth.admin.generateLink({
  type: "magiclink",
  email: email.trim().toLowerCase(),
});
if (error || !data?.properties?.hashed_token) {
  console.error("No se pudo generar el enlace:", error?.message ?? "respuesta inesperada");
  process.exit(1);
}

const link = `${site}/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink&next=${encodeURIComponent(next)}`;
console.log("\nAbre este enlace en tu navegador (sirve una sola vez):\n");
console.log(link, "\n");

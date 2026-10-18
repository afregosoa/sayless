import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { supabaseUser } from "./supabase/server";

export type CurrentUser = { id: string; email: string; isSuperadmin: boolean };

/** Usuario autenticado (validado contra Supabase) o null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  // La verificación de sesión usa la hora actual: debe ocurrir solo en tiempo de request.
  await connection();
  const supabase = await supabaseUser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .maybeSingle();
  return { id: user.id, email: user.email ?? "", isSuperadmin: profile?.is_superadmin ?? false };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireSuperadmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isSuperadmin) redirect("/app");
  return user;
}

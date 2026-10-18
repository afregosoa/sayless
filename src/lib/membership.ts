import "server-only";
import type { supabaseUser } from "./supabase/server";

type Client = Awaited<ReturnType<typeof supabaseUser>>;

/** ¿Es el usuario colaborador de este evento? (RLS solo deja ver sus propias membresías o las de sus eventos) */
export async function isEventMember(supabase: Client, eventId: string, userId: string) {
  const { data } = await supabase
    .from("event_members")
    .select("user_id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

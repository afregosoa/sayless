"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireSuperadmin } from "@/lib/auth";
import { AUDIO_BUCKET, MEDIA_BUCKET } from "@/lib/event-content";
import { DEFAULT_THEME, EVENT_TYPES, starterContent } from "@/lib/event-starter";
import { supabaseAdmin } from "@/lib/supabase-server";

export type AdminResult = { ok: true } | { ok: false; error: string };
export type AdminFormState = { ok?: string; error?: string };

// Estas acciones usan service_role (status, pago y dueño no son editables por clientes), así que
// SIEMPRE verifican primero que quien llama es superadmin, y dejan registro en audit_log.

const email = z.email().max(200).transform((s) => s.trim().toLowerCase());

function refresh() {
  revalidatePath("/admin");
  revalidatePath("/admin/clientes");
}

export async function setEventStatus(eventId: string, status: string): Promise<AdminResult> {
  const actor = await requireSuperadmin();
  const parsed = z.object({ id: z.uuid(), status: z.enum(["draft", "published", "closed"]) })
    .safeParse({ id: eventId, status });
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const db = supabaseAdmin();
  if (parsed.data.status !== "draft") {
    const { data } = await db.from("events").select("paid_at").eq("id", parsed.data.id).maybeSingle();
    if (!data?.paid_at) return { ok: false, error: "Marca el evento como pagado antes de publicarlo." };
  }
  const { error } = await db.from("events").update({ status: parsed.data.status }).eq("id", parsed.data.id);
  if (error) return { ok: false, error: "No se pudo cambiar el estado." };

  await audit(actor.id, parsed.data.id, "status_changed", { status: parsed.data.status });
  refresh();
  return { ok: true };
}

export async function setEventPaid(eventId: string, paid: boolean): Promise<AdminResult> {
  const actor = await requireSuperadmin();
  if (!z.uuid().safeParse(eventId).success) return { ok: false, error: "Evento inválido." };

  const { error } = await supabaseAdmin()
    .from("events")
    .update({ paid_at: paid ? new Date().toISOString() : null, ...(paid ? {} : { status: "draft" }) })
    .eq("id", eventId);
  if (error) return { ok: false, error: "No se pudo actualizar el pago." };

  await audit(actor.id, eventId, "paid_changed", { paid });
  refresh();
  return { ok: true };
}

/** Asigna un evento a un correo. Si esa persona aún no se registró, queda reservado hasta que lo haga. */
export async function assignOwner(eventId: string, rawEmail: string): Promise<AdminResult> {
  const actor = await requireSuperadmin();
  const to = email.safeParse(rawEmail);
  if (!to.success || !z.uuid().safeParse(eventId).success) return { ok: false, error: "Correo o evento inválido." };

  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("id").eq("email", to.data).maybeSingle();

  await db.from("owner_invites").delete().eq("event_id", eventId);
  if (profile) {
    const { error } = await db.from("events").update({ owner_id: profile.id }).eq("id", eventId);
    if (error) return { ok: false, error: "No se pudo asignar el evento." };
    await audit(actor.id, eventId, "owner_assigned", { to: to.data });
  } else {
    // El evento queda sin dueño y reservado: el primer inicio de sesión con ese correo lo reclama.
    const { error: e1 } = await db.from("events").update({ owner_id: null }).eq("id", eventId);
    const { error: e2 } = await db.from("owner_invites").insert({ email: to.data, event_id: eventId });
    if (e1 || e2) return { ok: false, error: "No se pudo reservar el evento." };
    await audit(actor.id, eventId, "owner_invited", { to: to.data });
  }
  refresh();
  return { ok: true };
}

const createSchema = z.object({
  email,
  title: z.string().trim().min(2).max(120),
  type: z.enum(EVENT_TYPES),
  slug: z.string().trim().toLowerCase().min(3).max(60).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** Crea un evento en nombre de un cliente (registrado o no). */
export async function createClientEvent(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const actor = await requireSuperadmin();
  const parsed = createSchema.safeParse({
    email: formData.get("email"),
    title: formData.get("title"),
    type: formData.get("type"),
    slug: formData.get("slug"),
    eventDate: formData.get("eventDate") || undefined,
  });
  if (!parsed.success) return { error: "Revisa correo, nombre y dirección (minúsculas, números y guiones)." };
  const { email: to, title, type, slug, eventDate } = parsed.data;

  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("id").eq("email", to).maybeSingle();

  const { data: event, error } = await db
    .from("events")
    .insert({
      owner_id: profile?.id ?? null,
      slug, type, title,
      event_date: eventDate ?? null,
      content: starterContent(title, type),
      theme: DEFAULT_THEME,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "Esa dirección ya está en uso." };
    if (error.code === "23514") return { error: "Esa dirección no está permitida." };
    return { error: "No se pudo crear el evento." };
  }
  if (!profile) await db.from("owner_invites").insert({ email: to, event_id: event.id });

  await audit(actor.id, event.id, "event_created_for_client", { to, registered: !!profile });
  refresh();
  return { ok: profile ? `Evento creado para ${to}.` : `Evento reservado: ${to} lo recibirá al iniciar sesión por primera vez.` };
}

/** Elimina un evento, sus invitados (cascada) y sus fotos. Pide escribir la dirección para confirmar. */
export async function deleteEvent(eventId: string, confirmSlug: string): Promise<AdminResult> {
  const actor = await requireSuperadmin();
  if (!z.uuid().safeParse(eventId).success) return { ok: false, error: "Evento inválido." };

  const db = supabaseAdmin();
  const { data: event } = await db.from("events").select("slug, title").eq("id", eventId).maybeSingle();
  if (!event) return { ok: false, error: "El evento no existe." };
  if (confirmSlug.trim() !== event.slug) return { ok: false, error: "La dirección no coincide." };

  const { data: files } = await db.storage.from(MEDIA_BUCKET).list(eventId, { limit: 100 });
  if (files?.length) await db.storage.from(MEDIA_BUCKET).remove(files.map((f) => `${eventId}/${f.name}`));
  const { data: songs } = await db.storage.from(AUDIO_BUCKET).list(eventId, { limit: 100 });
  if (songs?.length) await db.storage.from(AUDIO_BUCKET).remove(songs.map((f) => `${eventId}/${f.name}`));

  const { error } = await db.from("events").delete().eq("id", eventId);
  if (error) return { ok: false, error: "No se pudo eliminar el evento." };

  await audit(actor.id, null, "event_deleted", { slug: event.slug, title: event.title });
  refresh();
  return { ok: true };
}

/** Enciende o apaga el borrado automático de datos de invitados (90 días después del evento). */
export async function setRetentionEnabled(enabled: boolean): Promise<AdminResult> {
  const actor = await requireSuperadmin();
  const { error } = await supabaseAdmin()
    .from("app_settings")
    .upsert({ key: "retention_enabled", value: enabled, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: "No se pudo cambiar el interruptor." };

  await audit(actor.id, null, "retention_toggled", { enabled });
  revalidatePath("/admin");
  return { ok: true };
}

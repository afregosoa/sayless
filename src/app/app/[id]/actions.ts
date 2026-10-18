"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { parseCsv } from "@/lib/csv";
import { contentSchema } from "@/lib/event-content";
import { isReadyToPublish, publishChecklist } from "@/lib/publish-checklist";
import { getStripe } from "@/lib/stripe";
import { siteUrl } from "@/lib/site-url";
import { supabaseUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export type FormState = { ok?: string; error?: string };

// Todas las operaciones usan la sesión del usuario: RLS rechaza cualquier evento que no sea suyo.

const guestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  passes: z.coerce.number().int().min(1).max(10),
  phone: z.string().trim().max(30).optional(),
});

export async function addGuest(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const eventId = z.uuid().safeParse(formData.get("eventId"));
  const parsed = guestSchema.safeParse({
    name: formData.get("name"),
    passes: formData.get("passes"),
    phone: formData.get("phone") || undefined,
  });
  if (!eventId.success) return { error: "Evento inválido." };
  if (!parsed.success) return { error: "Revisa nombre (obligatorio) y pases (1 a 10)." };

  const supabase = await supabaseUser();
  const { error } = await supabase.from("guests").insert({
    event_id: eventId.data,
    name: parsed.data.name,
    passes: parsed.data.passes,
    phone: parsed.data.phone ?? null,
  });
  if (error) return { error: "No se pudo guardar el invitado." };

  revalidatePath(`/app/${eventId.data}`);
  return { ok: `${parsed.data.name} agregado.` };
}

export async function importGuests(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const eventId = z.uuid().safeParse(formData.get("eventId"));
  if (!eventId.success) return { error: "Evento inválido." };

  let rows = parseCsv(String(formData.get("csv") ?? ""));
  // Si la primera fila es encabezado (pases no numérico), se omite.
  if (rows.length && !/^\d+$/.test(rows[0][1] ?? "")) rows = rows.slice(1);
  if (!rows.length) return { error: "No hay filas para importar." };
  if (rows.length > 500) return { error: "Máximo 500 invitados por importación." };

  const valid: { event_id: string; name: string; passes: number; phone: string | null }[] = [];
  const bad: number[] = [];
  rows.forEach((r, i) => {
    const p = guestSchema.safeParse({ name: r[0], passes: r[1], phone: r[2] || undefined });
    if (p.success) valid.push({ event_id: eventId.data, name: p.data.name, passes: p.data.passes, phone: p.data.phone ?? null });
    else bad.push(i + 1);
  });
  if (bad.length) {
    return { error: `Filas inválidas (nada se importó): ${bad.slice(0, 10).join(", ")}. Formato: nombre, pases, teléfono.` };
  }

  const supabase = await supabaseUser();
  const { error } = await supabase.from("guests").insert(valid);
  if (error) return { error: "No se pudo importar la lista." };

  revalidatePath(`/app/${eventId.data}`);
  return { ok: `${valid.length} invitados importados.` };
}

export async function deleteGuest(id: string, eventId: string) {
  await requireUser();
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(eventId).success) return;
  const supabase = await supabaseUser();
  await supabase.from("guests").delete().eq("id", id).eq("event_id", eventId);
  revalidatePath(`/app/${eventId}`);
}

export async function updateGuest(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const ids = z.object({ id: z.uuid(), eventId: z.uuid() }).safeParse({
    id: formData.get("id"),
    eventId: formData.get("eventId"),
  });
  const parsed = guestSchema.safeParse({
    name: formData.get("name"),
    passes: formData.get("passes"),
    phone: formData.get("phone") || undefined,
  });
  if (!ids.success) return { error: "Invitado inválido." };
  if (!parsed.success) return { error: "Revisa nombre (obligatorio) y pases (1 a 10)." };

  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from("guests")
    .update({ name: parsed.data.name, passes: parsed.data.passes, phone: parsed.data.phone ?? null })
    .eq("id", ids.data.id)
    .eq("event_id", ids.data.eventId)
    .select("id");

  // 23514: violó "confirmed_count <= passes" (ya confirmaron más personas que los pases nuevos).
  if (error?.code === "23514") return { error: "Ya confirmaron más personas que esos pases." };
  if (error) return { error: "No se pudo guardar." };
  if (!data?.length) return { error: "No tienes permiso para editar este invitado." };

  revalidatePath(`/app/${ids.data.eventId}`);
  return { ok: "Guardado." };
}

// ── Acciones que solo puede hacer el DUEÑO del evento (no los colaboradores) ──

async function requireOwner(eventId: string) {
  const user = await requireUser();
  if (!z.uuid().safeParse(eventId).success) return null;
  const supabase = await supabaseUser();
  const { data } = await supabase.from("events").select("id").eq("id", eventId).eq("owner_id", user.id).maybeSingle();
  return data ? user : null;
}

/** El dueño da (1, 7 o 30 días) o revoca (0) el acceso de soporte a su evento. */
export async function setSupportAccess(eventId: string, days: number): Promise<FormState> {
  const owner = await requireOwner(eventId);
  const parsed = z.union([z.literal(0), z.literal(1), z.literal(7), z.literal(30)]).safeParse(days);
  if (!owner || !parsed.success) return { error: "No tienes permiso para cambiar esto." };

  const until = parsed.data === 0 ? null : new Date(Date.now() + parsed.data * 24 * 60 * 60 * 1000).toISOString();
  // Se escribe con service_role porque la columna no es editable desde la sesión del usuario
  // (así un colaborador no puede abrir el evento a soporte). La propiedad ya se verificó arriba.
  const { error } = await supabaseAdmin().from("events").update({ support_access_until: until }).eq("id", eventId);
  if (error) return { error: "No se pudo actualizar el acceso de soporte." };

  revalidatePath(`/app/${eventId}`);
  return { ok: until ? "Acceso de soporte activado." : "Acceso de soporte revocado." };
}

const MAX_COLLABORATORS = 5;
const emailSchema = z.email().max(200).transform((s) => s.trim().toLowerCase());

/** Invita a un colaborador por correo. Si aún no tiene cuenta, el evento le aparece al iniciar sesión. */
export async function inviteCollaborator(eventId: string, rawEmail: string): Promise<FormState> {
  const owner = await requireOwner(eventId);
  if (!owner) return { error: "Solo el dueño del evento puede invitar colaboradores." };
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { error: "Escribe un correo válido." };
  const email = parsed.data;
  if (email === owner.email.toLowerCase()) return { error: "Ese eres tú: ya eres el dueño." };

  const db = supabaseAdmin();
  const [{ count: members }, { count: invites }] = await Promise.all([
    db.from("event_members").select("*", { count: "exact", head: true }).eq("event_id", eventId),
    db.from("member_invites").select("*", { count: "exact", head: true }).eq("event_id", eventId),
  ]);
  if ((members ?? 0) + (invites ?? 0) >= MAX_COLLABORATORS) {
    return { error: `Máximo ${MAX_COLLABORATORS} colaboradores por evento.` };
  }

  const { data: profile } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
  const { error } = profile
    ? await db.from("event_members").upsert({ event_id: eventId, user_id: profile.id }, { onConflict: "event_id,user_id", ignoreDuplicates: true })
    : await db.from("member_invites").upsert({ event_id: eventId, email }, { onConflict: "event_id,email", ignoreDuplicates: true });
  if (error) return { error: "No se pudo invitar al colaborador." };

  await audit(owner.id, eventId, "member_added", { email });
  revalidatePath(`/app/${eventId}`);
  return {
    ok: profile
      ? `${email} ya puede editar este evento.`
      : `Invitación lista. Avísale a ${email} que inicie sesión con ese correo para ver el evento.`,
  };
}

export async function removeCollaborator(eventId: string, userId: string): Promise<FormState> {
  const owner = await requireOwner(eventId);
  if (!owner || !z.uuid().safeParse(userId).success) return { error: "No tienes permiso para cambiar esto." };

  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("email").eq("id", userId).maybeSingle();
  const { error } = await db.from("event_members").delete().eq("event_id", eventId).eq("user_id", userId);
  if (error) return { error: "No se pudo quitar al colaborador." };

  await audit(owner.id, eventId, "member_removed", { email: profile?.email ?? "" });
  revalidatePath(`/app/${eventId}`);
  return { ok: "Colaborador quitado." };
}

export async function cancelInvite(eventId: string, rawEmail: string): Promise<FormState> {
  const owner = await requireOwner(eventId);
  const parsed = emailSchema.safeParse(rawEmail);
  if (!owner || !parsed.success) return { error: "No tienes permiso para cambiar esto." };

  const { error } = await supabaseAdmin().from("member_invites").delete().eq("event_id", eventId).eq("email", parsed.data);
  if (error) return { error: "No se pudo cancelar la invitación." };

  revalidatePath(`/app/${eventId}`);
  return { ok: "Invitación cancelada." };
}

/**
 * Crea la sesión de pago de Stripe y manda al dueño a pagar. Solo el dueño, solo si el evento es
 * borrador, no está pagado y cumple lo requerido. La publicación la hace el webhook, no esta acción.
 */
export async function startCheckout(eventId: string): Promise<{ error: string }> {
  const owner = await requireOwner(eventId);
  if (!owner) return { error: "Solo el dueño del evento puede publicarlo." };

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId || !process.env.STRIPE_SECRET_KEY) return { error: "El pago aún no está configurado." };

  const supabase = await supabaseUser();
  const { data: event } = await supabase
    .from("events")
    .select("id, title, status, paid_at, event_date, rsvp_deadline, content")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return { error: "Evento no encontrado." };
  if (event.paid_at) return { error: "Este evento ya está pagado." };

  const content = contentSchema.safeParse(event.content);
  const { count } = await supabase.from("guests").select("*", { count: "exact", head: true }).eq("event_id", eventId);
  const checklist = content.success
    ? publishChecklist({ eventDate: event.event_date, rsvpDeadline: event.rsvp_deadline, content: content.data, guestCount: count ?? 0 })
    : [];
  if (!isReadyToPublish(checklist)) return { error: "Completa los pendientes de la lista antes de publicar." };

  let url: string | null = null;
  try {
    const base = await siteUrl();
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      allowed_payment_method_types: ["card"],
      client_reference_id: eventId,
      metadata: { event_id: eventId },
      customer_email: owner.email,
      allow_promotion_codes: true,
      locale: "es-419",
      success_url: `${base}/app/${eventId}?pago=ok`,
      cancel_url: `${base}/app/${eventId}?pago=cancelado`,
    });
    url = session.url;
  } catch (e) {
    console.error("Stripe: no se pudo crear la sesión de pago", e);
  }
  if (!url) return { error: "No pudimos iniciar el pago. Intenta de nuevo." };

  redirect(url);
}

/**
 * El dueño borra ya los datos personales de TODOS los invitados de su evento: nombre, teléfono y mensaje.
 * Se conservan los pases y los conteos de confirmación. Es irreversible, por eso pide escribir BORRAR.
 */
export async function anonymizeGuests(eventId: string, confirmation: string): Promise<FormState> {
  const owner = await requireOwner(eventId);
  if (!owner) return { error: "Solo el dueño del evento puede hacerlo." };
  if (confirmation.trim().toUpperCase() !== "BORRAR") return { error: 'Escribe BORRAR para confirmar.' };

  // service_role: la sesión del usuario no puede modificar message ni anonymized_at.
  const { data, error } = await supabaseAdmin()
    .from("guests")
    .update({ name: "Invitado (datos eliminados)", phone: null, message: null, anonymized_at: new Date().toISOString() })
    .eq("event_id", eventId)
    .is("anonymized_at", null)
    .select("id");
  if (error) return { error: "No se pudieron borrar los datos. Intenta de nuevo." };

  await audit(owner.id, eventId, "guests_anonymized", { count: data?.length ?? 0, reason: "owner_request" });
  revalidatePath(`/app/${eventId}`);
  return { ok: `Datos eliminados de ${data?.length ?? 0} invitados.` };
}

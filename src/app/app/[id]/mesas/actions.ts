"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { MAX_TABLES } from "@/lib/seating";
import { supabaseUser } from "@/lib/supabase/server";
import type { FormState } from "../actions";

// Con la sesión del usuario: RLS solo deja tocar mesas e invitados de eventos que puede editar.

const eventIdSchema = z.uuid();

const createSchema = z.object({
  count: z.coerce.number().int().min(1).max(40),
  capacity: z.coerce.number().int().min(1).max(50),
  prefix: z.string().trim().max(30).optional(),
});

export async function createTables(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const eventId = eventIdSchema.safeParse(formData.get("eventId"));
  const parsed = createSchema.safeParse({
    count: formData.get("count"),
    capacity: formData.get("capacity"),
    prefix: formData.get("prefix") || undefined,
  });
  if (!eventId.success) return { error: "Evento inválido." };
  if (!parsed.success) return { error: "Revisa la cantidad (1 a 40) y la capacidad (1 a 50)." };

  const supabase = await supabaseUser();
  const { data: existing, error: listError } = await supabase
    .from("event_tables")
    .select("position")
    .eq("event_id", eventId.data);
  if (listError) return { error: "No se pudieron crear las mesas." };
  const have = existing?.length ?? 0;
  if (have + parsed.data.count > MAX_TABLES) return { error: `Máximo ${MAX_TABLES} mesas por evento.` };

  const prefix = parsed.data.prefix || "Mesa";
  const lastPosition = Math.max(0, ...(existing ?? []).map((t) => t.position));
  const rows = Array.from({ length: parsed.data.count }, (_, i) => ({
    event_id: eventId.data,
    name: `${prefix} ${have + i + 1}`.slice(0, 40),
    capacity: parsed.data.capacity,
    position: lastPosition + i + 1,
  }));
  const { error } = await supabase.from("event_tables").insert(rows);
  if (error) return { error: "No se pudieron crear las mesas." };

  revalidatePath(`/app/${eventId.data}/mesas`);
  return { ok: parsed.data.count === 1 ? "Mesa creada." : `${parsed.data.count} mesas creadas.` };
}

const updateSchema = z.object({
  id: z.uuid(),
  eventId: z.uuid(),
  name: z.string().trim().min(1).max(40),
  capacity: z.coerce.number().int().min(1).max(50),
});

export async function updateTable(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    eventId: formData.get("eventId"),
    name: formData.get("name"),
    capacity: formData.get("capacity"),
  });
  if (!parsed.success) return { error: "Revisa el nombre y la capacidad (1 a 50)." };

  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from("event_tables")
    .update({ name: parsed.data.name, capacity: parsed.data.capacity })
    .eq("id", parsed.data.id)
    .eq("event_id", parsed.data.eventId)
    .select("id");
  if (error) return { error: "No se pudo guardar." };
  if (!data?.length) return { error: "No tienes permiso para editar esta mesa." };

  revalidatePath(`/app/${parsed.data.eventId}/mesas`);
  return { ok: "Guardado." };
}

export async function deleteTable(id: string, eventId: string) {
  await requireUser();
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(eventId).success) return;
  const supabase = await supabaseUser();
  // Los invitados de esa mesa quedan "sin mesa" (on delete set null).
  await supabase.from("event_tables").delete().eq("id", id).eq("event_id", eventId);
  revalidatePath(`/app/${eventId}/mesas`);
  revalidatePath(`/app/${eventId}`);
}

/** Cambia la mesa de una persona (o la quita con tableId = null). */
export async function assignMember(memberId: string, eventId: string, tableId: string | null): Promise<FormState> {
  await requireUser();
  const ok = z.uuid().safeParse(memberId).success && z.uuid().safeParse(eventId).success
    && (tableId === null || z.uuid().safeParse(tableId).success);
  if (!ok) return { error: "Datos inválidos." };

  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from("guest_members")
    .update({ table_id: tableId })
    .eq("id", memberId)
    .eq("event_id", eventId)
    .select("id");
  if (error?.code === "23514") return { error: "Esa mesa no pertenece a este evento." };
  if (error) return { error: "No se pudo asignar la mesa." };
  if (!data?.length) return { error: "No tienes permiso para cambiar a esta persona." };

  revalidatePath(`/app/${eventId}/mesas`);
  revalidatePath(`/app/${eventId}`);
  return { ok: "Asignado." };
}

/** Sienta en una mesa a todas las personas de la invitación que aún no tienen mesa (y no declinaron). */
export async function assignGroup(guestId: string, eventId: string, tableId: string): Promise<FormState> {
  await requireUser();
  if (!z.uuid().safeParse(guestId).success || !z.uuid().safeParse(eventId).success || !z.uuid().safeParse(tableId).success) {
    return { error: "Datos inválidos." };
  }

  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from("guest_members")
    .update({ table_id: tableId })
    .eq("guest_id", guestId)
    .eq("event_id", eventId)
    .is("table_id", null)
    .or("attending.is.null,attending.eq.true")
    .select("id");
  if (error?.code === "23514") return { error: "Esa mesa no pertenece a este evento." };
  if (error) return { error: "No se pudo asignar la mesa." };
  if (!data?.length) return { error: "Nadie de esta invitación está pendiente de mesa." };

  revalidatePath(`/app/${eventId}/mesas`);
  revalidatePath(`/app/${eventId}`);
  return { ok: "Asignados." };
}

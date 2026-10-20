"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { CANVAS_MAX_Y, CANVAS_W, ITEM_KINDS, MAX_ITEMS, TABLE_SHAPES } from "@/lib/salon";
import { supabaseUser } from "@/lib/supabase/server";

// Con la sesión del usuario: RLS solo deja tocar el plano de eventos que puede editar.
// Estas acciones no revalidan la página: el lienzo ya muestra el cambio al instante y la base de datos lo confirma.

export type LayoutResult = { error?: string };
export type LayoutItem = { id: string; kind: (typeof ITEM_KINDS)[number]; label: string; x: number; y: number; w: number; h: number; rotation: number };

const uuid = z.uuid();
const coordX = z.number().finite().min(0).max(CANVAS_W);
const coordY = z.number().finite().min(0).max(CANVAS_MAX_Y);
const rotation = z.number().int().min(-360).max(360);

const tablePatch = z.object({
  x: coordX.optional(),
  y: coordY.optional(),
  shape: z.enum(TABLE_SHAPES).optional(),
  rotation: rotation.optional(),
});

export async function updateTableLayout(eventId: string, tableId: string, patch: unknown): Promise<LayoutResult> {
  await requireUser();
  const parsed = tablePatch.safeParse(patch);
  if (!uuid.safeParse(eventId).success || !uuid.safeParse(tableId).success || !parsed.success) return { error: "Datos inválidos." };

  const supabase = await supabaseUser();
  const { data, error } = await supabase.from("event_tables").update(parsed.data).eq("id", tableId).eq("event_id", eventId).select("id");
  if (error) return { error: "No se pudo guardar el plano." };
  if (!data?.length) return { error: "No tienes permiso para cambiar esta mesa." };
  return {};
}

/** Guarda varias posiciones de una vez (acomodo automático o primera colocación). */
export async function saveTablePositions(eventId: string, rows: { id: string; x: number; y: number }[]): Promise<LayoutResult> {
  await requireUser();
  const parsed = z.array(z.object({ id: uuid, x: coordX, y: coordY })).max(200).safeParse(rows);
  if (!uuid.safeParse(eventId).success || !parsed.success) return { error: "Datos inválidos." };

  const supabase = await supabaseUser();
  const results = await Promise.all(
    parsed.data.map((r) => supabase.from("event_tables").update({ x: r.x, y: r.y }).eq("id", r.id).eq("event_id", eventId)),
  );
  if (results.some((r) => r.error)) return { error: "No se pudo guardar el plano." };
  return {};
}

const itemSchema = z.object({
  kind: z.enum(ITEM_KINDS),
  label: z.string().trim().max(40),
  x: coordX, y: coordY,
  w: z.number().finite().min(20).max(CANVAS_W),
  h: z.number().finite().min(20).max(800),
  rotation,
});

export async function addLayoutItem(eventId: string, input: unknown): Promise<LayoutResult & { item?: LayoutItem }> {
  await requireUser();
  const parsed = itemSchema.safeParse(input);
  if (!uuid.safeParse(eventId).success || !parsed.success) return { error: "Datos inválidos." };

  const supabase = await supabaseUser();
  const { count } = await supabase.from("event_layout_items").select("id", { count: "exact", head: true }).eq("event_id", eventId);
  if ((count ?? 0) >= MAX_ITEMS) return { error: `Máximo ${MAX_ITEMS} elementos en el salón.` };

  const { data, error } = await supabase
    .from("event_layout_items")
    .insert({ event_id: eventId, ...parsed.data })
    .select("id, kind, label, x, y, w, h, rotation")
    .single();
  if (error || !data) return { error: "No se pudo agregar el elemento." };
  return { item: { ...data, x: Number(data.x), y: Number(data.y), w: Number(data.w), h: Number(data.h) } as LayoutItem };
}

const itemPatch = itemSchema.omit({ kind: true }).partial();

export async function updateLayoutItem(eventId: string, itemId: string, patch: unknown): Promise<LayoutResult> {
  await requireUser();
  const parsed = itemPatch.safeParse(patch);
  if (!uuid.safeParse(eventId).success || !uuid.safeParse(itemId).success || !parsed.success) return { error: "Datos inválidos." };

  const supabase = await supabaseUser();
  const { data, error } = await supabase.from("event_layout_items").update(parsed.data).eq("id", itemId).eq("event_id", eventId).select("id");
  if (error) return { error: "No se pudo guardar el plano." };
  if (!data?.length) return { error: "No tienes permiso para cambiar este elemento." };
  return {};
}

export async function deleteLayoutItem(eventId: string, itemId: string): Promise<LayoutResult> {
  await requireUser();
  if (!uuid.safeParse(eventId).success || !uuid.safeParse(itemId).success) return { error: "Datos inválidos." };
  const supabase = await supabaseUser();
  const { error } = await supabase.from("event_layout_items").delete().eq("id", itemId).eq("event_id", eventId);
  if (error) return { error: "No se pudo quitar el elemento." };
  return {};
}

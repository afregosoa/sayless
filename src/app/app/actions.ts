"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { DEFAULT_THEME, EVENT_TYPES, starterContent } from "@/lib/event-starter";
import { supabaseUser } from "@/lib/supabase/server";

export type CreateEventState = { error?: string };

const schema = z.object({
  title: z.string().trim().min(2).max(120),
  type: z.enum(EVENT_TYPES),
  slug: z.string().trim().toLowerCase().min(3).max(60).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function createEvent(_prev: CreateEventState, formData: FormData): Promise<CreateEventState> {
  const user = await requireUser();
  const parsed = schema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    slug: formData.get("slug"),
    eventDate: formData.get("eventDate") || undefined,
  });
  if (!parsed.success) {
    return { error: "Revisa el nombre y la dirección (solo letras minúsculas, números y guiones; mínimo 3 caracteres)." };
  }
  const { title, type, slug, eventDate } = parsed.data;

  // Cliente con la sesión del usuario: RLS garantiza que solo pueda crear eventos a su nombre.
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from("events")
    .insert({
      owner_id: user.id,
      slug,
      type,
      title,
      event_date: eventDate ?? null,
      content: starterContent(title, type),
      theme: DEFAULT_THEME,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Esa dirección ya está en uso. Prueba otra." };
    if (error.code === "23514") return { error: "Esa dirección no está permitida. Prueba otra." };
    return { error: "No se pudo crear el evento." };
  }
  redirect(`/app/${data.id}`);
}

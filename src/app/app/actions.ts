"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { EVENT_TYPES, starterContent } from "@/lib/event-starter";
import { isTemplateId, TEMPLATES, templatesFor } from "@/templates/catalog";
import { supabaseUser } from "@/lib/supabase/server";

export type CreateEventState = { error?: string };

const schema = z.object({
  title: z.string().trim().min(2).max(120),
  type: z.enum(EVENT_TYPES),
  slug: z.string().trim().toLowerCase().min(3).max(60).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  template: z.string().optional(),
});

export async function createEvent(_prev: CreateEventState, formData: FormData): Promise<CreateEventState> {
  const user = await requireUser();
  const parsed = schema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    slug: formData.get("slug"),
    eventDate: formData.get("eventDate") || undefined,
    template: formData.get("template") || undefined,
  });
  if (!parsed.success) {
    return { error: "Revisa el nombre y la dirección (solo letras minúsculas, números y guiones; mínimo 3 caracteres)." };
  }
  const { title, type, slug, eventDate } = parsed.data;
  // La plantilla debe existir y estar disponible para ese tipo de evento; si no, la editorial.
  const template = isTemplateId(parsed.data.template) && templatesFor(type).some((t) => t.id === parsed.data.template)
    ? parsed.data.template
    : "editorial";

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
      template,
      theme: TEMPLATES[template].theme, // sus colores iniciales; el cliente los puede cambiar en el editor
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Esa dirección ya está en uso. Prueba otra." };
    if (error.code === "23514") return { error: "Esa dirección no está permitida. Prueba otra." };
    console.error("createEvent falló", { code: error.code, message: error.message, details: error.details, hint: error.hint });
    return { error: "No se pudo crear el evento." };
  }
  redirect(`/app/${data.id}`);
}

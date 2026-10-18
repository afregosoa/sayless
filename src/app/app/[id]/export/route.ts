import { getCurrentUser } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { supabaseUser } from "@/lib/supabase/server";

export async function GET(_req: Request, ctx: RouteContext<"/app/[id]/export">) {
  if (!(await getCurrentUser())) return new Response("No autorizado", { status: 401 });
  const { id } = await ctx.params;

  // RLS: si el evento no es del usuario, la consulta no devuelve filas.
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from("guests")
    .select("name, code, passes, phone, attending, confirmed_count, message, confirmed_at")
    .eq("event_id", id)
    .order("name");
  if (error) return new Response("Error al exportar", { status: 500 });

  const rows = [
    ["Nombre", "Código", "Pases", "Teléfono", "Estado", "Confirmados", "Mensaje", "Respondió"],
    ...data.map((g) => [
      g.name, g.code, g.passes, g.phone,
      g.attending === null ? "Pendiente" : g.attending ? "Asiste" : "No asiste",
      g.confirmed_count, g.message, g.confirmed_at,
    ]),
  ];

  return new Response("﻿" + toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="invitados.csv"',
      "Cache-Control": "no-store",
    },
  });
}

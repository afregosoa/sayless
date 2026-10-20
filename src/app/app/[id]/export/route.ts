import { getCurrentUser } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { peopleSummary, tableSummary } from "@/lib/seating";
import { supabaseUser } from "@/lib/supabase/server";

// /export                → una fila por invitación (familia o grupo)
// /export?por=persona    → una fila por persona, con su mesa (para el acomodo)
export async function GET(req: Request, ctx: RouteContext<"/app/[id]/export">) {
  if (!(await getCurrentUser())) return new Response("No autorizado", { status: 401 });
  const { id } = await ctx.params;
  const porPersona = new URL(req.url).searchParams.get("por") === "persona";

  // RLS: si el evento no es del usuario, la consulta no devuelve filas.
  const supabase = await supabaseUser();
  const [{ data, error }, { data: tableRows }, { data: memberRows }] = await Promise.all([
    supabase
      .from("guests")
      .select("id, name, code, passes, phone, attending, confirmed_count, message, confirmed_at")
      .eq("event_id", id)
      .order("name"),
    supabase.from("event_tables").select("id, name").eq("event_id", id),
    supabase.from("guest_members").select("id, guest_id, position, name, attending, table_id").eq("event_id", id).order("position"),
  ]);
  if (error || !data) return new Response("Error al exportar", { status: 500 });

  const tableName = new Map((tableRows ?? []).map((t) => [t.id, t.name]));
  const membersByGuest = new Map<string, NonNullable<typeof memberRows>>();
  for (const m of memberRows ?? []) membersByGuest.set(m.guest_id, [...(membersByGuest.get(m.guest_id) ?? []), m]);
  const estado = (a: boolean | null) => (a === null ? "Pendiente" : a ? "Asiste" : "No asiste");

  const rows = porPersona
    ? [
        ["Invitación", "Código", "Persona", "Estado", "Mesa"],
        ...data.flatMap((g) =>
          (membersByGuest.get(g.id) ?? []).map((m) => [
            g.name, g.code, m.name ?? `Lugar ${m.position}`, estado(m.attending), m.table_id ? tableName.get(m.table_id) : "",
          ]),
        ),
      ]
    : [
        ["Nombre", "Código", "Pases", "Teléfono", "Estado", "Confirmados", "Personas", "Mesa", "Mensaje", "Respondió"],
        ...data.map((g) => {
          const people = membersByGuest.get(g.id) ?? [];
          return [
            g.name, g.code, g.passes, g.phone, estado(g.attending), g.confirmed_count,
            peopleSummary(people, g.passes), tableSummary(people, tableName), g.message, g.confirmed_at,
          ];
        }),
      ];

  return new Response("\uFEFF" + toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${porPersona ? "personas" : "invitados"}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

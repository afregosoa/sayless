import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { eventAccess } from "@/lib/access";
import { auditSupportView } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { isEventMember } from "@/lib/membership";
import { takesSeat } from "@/lib/seating";
import type { ItemKind, TableShape } from "@/lib/salon";
import { supabaseUser } from "@/lib/supabase/server";
import { CreateTablesForm, GroupSelect, MemberSelect, PrintButton, TableTools, type TableOption } from "./seating-controls";
import { SeatingBoard, type BoardPerson } from "./seating-board";

export const metadata: Metadata = { title: "Mesas", robots: { index: false, follow: false } };

export default function TablesPage(props: PageProps<"/app/[id]/mesas">) {
  return (
    <main className="admin admin-wide">
      <Suspense fallback={<p>Cargando…</p>}>
        <Content params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Content({ params, searchParams }: {
  params: PageProps<"/app/[id]/mesas">["params"];
  searchParams: PageProps<"/app/[id]/mesas">["searchParams"];
}) {
  const user = await requireUser();
  const { id } = await params;
  const { vista } = await searchParams;
  const listView = vista === "lista";
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await supabaseUser();
  const { data: event } = await supabase
    .from("events")
    .select("id, title, slug, owner_id, support_access_until")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();

  const isMember = event.owner_id !== user.id && (await isEventMember(supabase, event.id, user.id));
  const access = eventAccess(user, event, isMember);
  if (access === "readonly") {
    return (
      <div className="adm-card">
        <h2>Acceso restringido</h2>
        <p>Solo el dueño, sus colaboradores o soporte (con permiso del dueño) pueden organizar las mesas.</p>
        <Link href="/admin" className="adm-link">← Volver</Link>
      </div>
    );
  }
  if (access === "support") await auditSupportView(user.id, event.id);

  const [{ data: tablesRaw, error: tablesError }, { data: guestsRaw }, { data: membersRaw }, { data: itemsRaw, error: itemsError }] = await Promise.all([
    supabase.from("event_tables").select("id, name, capacity, position, x, y, shape, rotation").eq("event_id", event.id).order("position"),
    supabase.from("guests").select("id, name").eq("event_id", event.id).order("name"),
    supabase.from("guest_members").select("id, guest_id, position, name, attending, table_id").eq("event_id", event.id).order("position"),
    supabase.from("event_layout_items").select("id, kind, label, x, y, w, h, rotation").eq("event_id", event.id).order("created_at"),
  ]);
  if (tablesError || itemsError) {
    // Casi siempre: falta correr la migración 016 (plano del salón).
    console.error("No se pudo cargar el plano de mesas", { tables: tablesError?.message, items: itemsError?.message });
    return (
      <div className="adm-card">
        <h2>No se pudo cargar el plano</h2>
        <p className="adm-err">Revisa que la base de datos tenga aplicada la migración 016 (plano del salón) e intenta de nuevo.</p>
        <Link href={`/app/${event.id}`} className="adm-link">← Volver al evento</Link>
      </div>
    );
  }
  const tables = tablesRaw ?? [];
  const guests = guestsRaw ?? [];
  const members = membersRaw ?? [];
  const groupName = new Map(guests.map((g) => [g.id, g.name]));

  // Cada persona ocupa un lugar (salvo quien declinó). Las que no tienen mesa están "por ubicar".
  const usedBy = new Map<string, number>();
  for (const m of members) if (m.table_id && takesSeat(m)) usedBy.set(m.table_id, (usedBy.get(m.table_id) ?? 0) + 1);
  const options: TableOption[] = tables.map((t) => ({ id: t.id, name: t.name, free: t.capacity - (usedBy.get(t.id) ?? 0) }));

  const unseated = members.filter((m) => !m.table_id && takesSeat(m));
  const unseatedByGuest = new Map<string, typeof members>();
  for (const m of unseated) unseatedByGuest.set(m.guest_id, [...(unseatedByGuest.get(m.guest_id) ?? []), m]);
  const pendingGuests = guests.filter((g) => unseatedByGuest.has(g.id));

  const seated = [...usedBy.values()].reduce((a, b) => a + b, 0);
  const capacity = tables.reduce((n, t) => n + t.capacity, 0);

  const boardPeople: BoardPerson[] = members.map((m) => ({
    id: m.id, guestId: m.guest_id, guestName: groupName.get(m.guest_id) ?? "", name: m.name,
    position: m.position, attending: m.attending, tableId: m.table_id,
  }));

  const stats: [string, number, string?][] = [
    ["Mesas", tables.length, `${capacity} lugares`],
    ["Personas sentadas", seated],
    ["Personas sin mesa", unseated.length, `${pendingGuests.length} invitaciones`],
  ];

  return (
    <>
      <header className="adm-head">
        <div>
          <Link href={`/app/${event.id}`} className="adm-hint">← {event.title}</Link>
          <h1>Mesas</h1>
          <p className="adm-hint">
            Cada persona se sienta por separado, así que una familia puede quedar en varias mesas. Quien no asiste no ocupa lugar; quien aún no responde cuenta como previsión.
          </p>
        </div>
        <div className="adm-actions seat-noprint"><PrintButton /></div>
      </header>

      <div className="adm-stats">
        {stats.map(([label, value, sub]) => (
          <div key={label} className="adm-card">
            <b>{value}</b>
            <span>{label}</span>
            {sub && <small>{sub}</small>}
          </div>
        ))}
      </div>

      <div className="seat-noprint"><CreateTablesForm eventId={event.id} /></div>

      {tables.length > 0 && (
        <nav className="adm-filters seat-noprint" aria-label="Vista">
          <Link href={`/app/${event.id}/mesas`} aria-current={!listView ? "page" : undefined}>Plano</Link>
          <Link href={`/app/${event.id}/mesas?vista=lista`} aria-current={listView ? "page" : undefined}>Lista</Link>
        </nav>
      )}

      {tables.length === 0 ? (
        <div className="adm-card"><p>Aún no hay mesas. Agrega las primeras arriba para empezar a ubicar a tus invitados.</p></div>
      ) : listView ? (
        <div className="seat-layout">
          <aside className="adm-card seat-pending seat-noprint" aria-label="Invitados sin mesa">
            <h2>Por ubicar <small>({unseated.length})</small></h2>
            {pendingGuests.length === 0 ? (
              <p className="adm-hint">Todos tienen mesa.</p>
            ) : (
              <ul className="adm-plain">
                {pendingGuests.map((g) => {
                  const pend = unseatedByGuest.get(g.id)!;
                  return (
                    <li key={g.id} className="seat-group-box">
                      <div className="seat-group-head">
                        <b>{g.name}</b>
                        <small>{pend.length} {pend.length === 1 ? "persona" : "personas"}</small>
                      </div>
                      {pend.length > 1 && <GroupSelect eventId={event.id} guestId={g.id} tables={options} />}
                      <ul className="adm-plain">
                        {pend.map((m) => (
                          <li key={m.id} className="seat-guest">
                            <div>
                              <b>{m.name ?? `Lugar ${m.position}`}</b>
                              {m.attending === null && <small>por confirmar</small>}
                            </div>
                            <MemberSelect eventId={event.id} memberId={m.id} value={null} tables={options} />
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          <div className="seat-grid">
            {tables.map((t) => {
              const used = usedBy.get(t.id) ?? 0;
              const over = used > t.capacity;
              const here = members.filter((m) => m.table_id === t.id);
              return (
                <div key={t.id} className="adm-card seat-card" role="group" aria-label={t.name} data-over={over || undefined}>
                  <header>
                    <h3>{t.name}</h3>
                    <span className="seat-count">{used}/{t.capacity}</span>
                  </header>
                  <div className="seat-bar" role="img" aria-label={`${used} de ${t.capacity} lugares ocupados`}>
                    <i style={{ width: `${Math.min(100, (used / t.capacity) * 100)}%` }} />
                  </div>
                  {over && <small className="adm-err">Sobrecupo: {used - t.capacity} {used - t.capacity === 1 ? "persona" : "personas"} de más.</small>}
                  {here.length === 0 ? (
                    <p className="adm-hint">Sin invitados.</p>
                  ) : (
                    <ul className="adm-plain">
                      {here.map((m) => (
                        <li key={m.id} className="seat-guest" data-declined={m.attending === false || undefined}>
                          <div>
                            <b>{m.name ?? `Lugar ${m.position}`}</b>
                            <small>
                              {groupName.get(m.guest_id)}
                              {m.attending === false ? " · No asiste" : m.attending === null ? " · por confirmar" : ""}
                            </small>
                          </div>
                          <span className="seat-noprint">
                            <MemberSelect eventId={event.id} memberId={m.id} value={t.id} tables={options} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="seat-noprint"><TableTools eventId={event.id} table={t} /></div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <SeatingBoard
          eventId={event.id}
          eventTitle={event.title}
          fileName={`plano-de-mesas-${event.slug}`}
          tables={tables.map((t) => ({
            id: t.id, name: t.name, capacity: t.capacity, x: t.x === null ? null : Number(t.x), y: t.y === null ? null : Number(t.y),
            shape: t.shape as TableShape, rotation: t.rotation,
          }))}
          people={boardPeople}
          items={(itemsRaw ?? []).map((i) => ({ ...i, kind: i.kind as ItemKind, x: Number(i.x), y: Number(i.y), w: Number(i.w), h: Number(i.h) }))}
        />
      )}
    </>
  );
}

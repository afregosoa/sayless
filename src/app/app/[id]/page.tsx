import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { z } from "zod";
import { notFound } from "next/navigation";
import { eventAccess } from "@/lib/access";
import { auditSupportView } from "@/lib/audit";
import { isEventMember } from "@/lib/membership";
import { supabaseAdmin } from "@/lib/supabase-server";
import { auditLabel } from "@/lib/audit-labels";
import { requireUser } from "@/lib/auth";
import { supabaseUser } from "@/lib/supabase/server";
import { signOut } from "../../login/actions";
import { AddGuestForm, ImportForm } from "./guest-forms";
import { CopyLink, DeleteButton, EditGuest } from "./row-actions";
import { CollaboratorsCard } from "./collaborators-card";
import { DataDeletionCard } from "./data-deletion-card";
import { PublishButton } from "./publish-button";
import { SupportCard } from "./support-card";
import { getPriceLabel } from "@/lib/pricing";
import { addDays, contentSchema, formatDay } from "@/lib/event-content";
import { RETENTION_DAYS, retentionEnabled } from "@/lib/retention";
import { isReadyToPublish, publishChecklist } from "@/lib/publish-checklist";
import { peopleSummary, tableSummary } from "@/lib/seating";
import { DIETS, DIET_LABELS, cleanDiet, dietText } from "@/lib/diet";

export const metadata: Metadata = {
  title: "Invitados",
  robots: { index: false, follow: false },
};

type Filter = "todos" | "pendientes" | "asisten" | "no";
const FILTERS: [Filter, string][] = [
  ["todos", "Todos"],
  ["pendientes", "Pendientes"],
  ["asisten", "Asisten"],
  ["no", "No asisten"],
];

export default function EventAdminPage(props: PageProps<"/app/[id]">) {
  return (
    <main className="admin">
      <Suspense fallback={<p>Cargando…</p>}>
        <AdminContent params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function AdminContent({
  params,
  searchParams,
}: {
  params: PageProps<"/app/[id]">["params"];
  searchParams: PageProps<"/app/[id]">["searchParams"];
}) {
  const user = await requireUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await supabaseUser();
  // RLS: solo devuelve el evento si es del usuario (o si es superadmin).
  const { data: event } = await supabase
    .from("events")
    .select("id, title, slug, status, paid_at, rsvp_deadline, locale, event_date, content, owner_id, support_access_until")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();

  const isMember = event.owner_id !== user.id && (await isEventMember(supabase, event.id, user.id));
  const access = eventAccess(user, event, isMember);

  // Operador sin permiso del cliente: solo estado y conteos, nunca invitados.
  if (access === "readonly") {
    const { data: statsRaw } = await supabase.rpc("event_guest_stats");
    const stat = ((statsRaw ?? []) as { event_id: string; guests: number; answered: number; people: number }[])
      .find((s) => s.event_id === event.id);
    return (
      <>
        <header className="adm-head">
          <div>
            <Link href="/admin" className="adm-hint">← Operador</Link>
            <h1>{event.title}</h1>
            <p className="adm-hint">/{event.slug} · {event.status}</p>
          </div>
        </header>
        <div className="adm-card">
          <h2>Acceso restringido</h2>
          <p>
            Este evento pertenece a un cliente, que no ha dado acceso de soporte. Solo puedes ver su estado y conteos:{" "}
            {stat ? `${stat.guests} invitados, ${stat.answered} respondieron, ${stat.people} personas confirmadas.` : "sin invitados."}
          </p>
          <p className="adm-hint">Si el cliente necesita ayuda, puede activar el acceso desde su evento.</p>
        </div>
      </>
    );
  }
  if (access === "support") await auditSupportView(user.id, event.id);

  const { data: activity } = access === "owner" || access === "editor"
    ? await supabase.from("audit_log").select("id, at, action, details").eq("event_id", event.id).order("at", { ascending: false }).limit(10)
    : { data: null };
  let collaborators: { userId: string; email: string }[] = [];
  let pendingInvites: string[] = [];
  if (access === "owner") {
    // service_role: el dueño necesita ver los correos, que las políticas de profiles no le muestran.
    const db = supabaseAdmin();
    const [{ data: members }, { data: invites }] = await Promise.all([
      db.from("event_members").select("user_id").eq("event_id", event.id),
      db.from("member_invites").select("email").eq("event_id", event.id),
    ]);
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profs } = ids.length ? await db.from("profiles").select("id, email").in("id", ids) : { data: [] };
    collaborators = (profs ?? []).map((p) => ({ userId: p.id, email: p.email ?? "" }));
    pendingInvites = (invites ?? []).map((i) => i.email);
  }
  // Fecha de borrado automático: solo se muestra si la retención está encendida y el evento tiene fecha.
  const retentionDate =
    event.event_date && (await retentionEnabled())
      ? formatDay(addDays(event.event_date, RETENTION_DAYS), event.locale)
      : null;
  const priceLabel = access === "owner" && event.status === "draft" ? await getPriceLabel() : null;
  const supportActive = !!event.support_access_until && new Date(event.support_access_until) > new Date();

  const deadline = event.rsvp_deadline ? formatDay(event.rsvp_deadline, event.locale) : null;
  const { f, pago } = await searchParams;
  const filter: Filter = FILTERS.some(([k]) => k === f) ? (f as Filter) : "todos";

  const { data, error } = await supabase
    .from("guests")
    .select("id, name, code, passes, phone, attending, confirmed_count, message, confirmed_at")
    .eq("event_id", event.id)
    .order("name");
  if (error) {
    console.error("No se pudo cargar la lista de invitados", { code: error.code, message: error.message });
    return <p className="adm-err">No se pudo cargar la lista.</p>;
  }
  const guests = data ?? [];
  const [{ data: tableRows }, { data: memberRows }] = await Promise.all([
    supabase.from("event_tables").select("id, name").eq("event_id", event.id),
    supabase.from("guest_members").select("id, guest_id, name, attending, table_id, diet, allergies").eq("event_id", event.id).order("position"),
  ]);
  const tableName = new Map((tableRows ?? []).map((t) => [t.id, t.name]));
  const membersByGuest = new Map<string, { id: string; name: string | null; attending: boolean | null; table_id: string | null; diet: string[]; allergies: string | null }[]>();
  for (const m of memberRows ?? []) membersByGuest.set(m.guest_id, [...(membersByGuest.get(m.guest_id) ?? []), m]);

  const content = contentSchema.safeParse(event.content);
  const checklist = content.success
    ? publishChecklist({
        eventDate: event.event_date,
        rsvpDeadline: event.rsvp_deadline,
        content: content.data,
        guestCount: guests.length,
      })
    : [];
  const ready = isReadyToPublish(checklist);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = `${proto}://${host}`;

  const answered = guests.filter((g) => g.attending !== null);
  const going = guests.filter((g) => g.attending === true);
  const declined = guests.filter((g) => g.attending === false);
  const pending = guests.filter((g) => g.attending === null);
  const sum = (xs: { passes?: number; confirmed_count?: number | null }[], k: "passes" | "confirmed_count") =>
    xs.reduce((n, g) => n + (g[k] ?? 0), 0);

  // Resumen para el menú: quienes asisten (o aún no responden), con su alimentación y alergias.
  const askDiet = content.success ? !!content.data.rsvp?.ask_diet : false;
  const guestName = new Map(guests.map((g) => [g.id, g.name]));
  const eaters = (memberRows ?? []).filter((m) => m.attending !== false);
  const dietCounts = DIETS.map((d) => [d, eaters.filter((m) => cleanDiet(m.diet).includes(d)).length] as const).filter(([, n]) => n > 0);
  const allergyList = eaters.filter((m) => m.allergies?.trim());
  const showDietCard = askDiet || dietCounts.length > 0 || allergyList.length > 0;

  const stats: [string, number, string?][] = [
    ["Personas confirmadas", sum(going, "confirmed_count"), `de ${sum(guests, "passes")} pases`],
    ["Invitaciones", guests.length],
    ["Respondieron", answered.length, `${pending.length} pendientes`],
    ["Asisten", going.length],
    ["No asisten", declined.length],
    ["Pases sin responder", sum(pending, "passes")],
  ];

  const visible = guests.filter((g) =>
    filter === "pendientes" ? g.attending === null
      : filter === "asisten" ? g.attending === true
      : filter === "no" ? g.attending === false
      : true,
  );

  return (
    <>
      <header className="adm-head">
        <div>
          <Link href={user.isSuperadmin ? "/admin" : "/app"} className="adm-hint">← Mis eventos</Link>
          <h1>{event.title}</h1>
          <p className="adm-hint">
            <Link href={`/${event.slug}`} target="_blank">/{event.slug}</Link> · {event.status === "published" ? "Publicado" : event.status === "closed" ? "Cerrado" : "Borrador"}
          </p>
        </div>
        <div className="adm-actions">
          <Link className="adm-btn" href={`/app/${event.id}/editar`}>Editar invitación</Link>
          <Link className="adm-btn adm-ghost" href={`/app/${event.id}/mesas`}>Mesas</Link>
          {/* Descarga de archivo (route handler): debe ser un <a>, no navegación de cliente */}
          <a className="adm-btn adm-ghost" href={`/app/${event.id}/export`}>Exportar CSV</a>
          <a className="adm-btn adm-ghost" href={`/app/${event.id}/export?por=persona`}>CSV por persona</a>
          <form action={signOut}><button className="adm-btn adm-ghost">Salir</button></form>
        </div>
      </header>

      {access === "support" && (
        <div className="adm-card adm-banner" role="status">
          Estás en <b>modo soporte</b> hasta{" "}
          <time dateTime={event.support_access_until ?? ""} suppressHydrationWarning>
            {event.support_access_until ? new Date(event.support_access_until).toLocaleString("es-MX") : ""}
          </time>
          . Tus acciones quedan registradas y el cliente puede verlas.
        </div>
      )}

      {pago === "ok" && event.status === "draft" && (
        <div className="adm-card adm-banner" role="status">
          Recibimos tu pago. Estamos publicando tu invitación; recarga la página en unos segundos.
        </div>
      )}
      {pago === "cancelado" && event.status === "draft" && (
        <div className="adm-card adm-banner" role="status">
          El pago se canceló. No se te cobró nada y tu evento sigue en borrador.
        </div>
      )}
      {event.status === "published" && (
        <div className="adm-card adm-banner" role="status">
          <b>Tu invitación está publicada.</b> Comparte su dirección general o los links personales de cada invitado:{" "}
          <Link href={`/${event.slug}`} target="_blank">{base}/{event.slug}</Link>
        </div>
      )}

      {event.status === "draft" && checklist.length > 0 && (
        <div className="adm-card adm-checklist" role="region" aria-labelledby="check-h">
          <h2 id="check-h">{ready ? "Tu invitación está lista para publicar" : "Antes de publicar"}</h2>
          <ul>
            {checklist.map((item) => (
              <li key={item.id} data-done={item.done}>
                <span aria-hidden>{item.done ? "✓" : "○"}</span>
                {item.label}
                {!item.done && !item.required && <small> · recomendado</small>}
              </li>
            ))}
          </ul>
          {!ready && <Link className="adm-link" href={`/app/${event.id}/editar`}>Ir al editor →</Link>}
          {ready && access === "owner" && <PublishButton eventId={event.id} priceLabel={priceLabel} />}
          {ready && access !== "owner" && (
            <p className="adm-hint">El dueño del evento es quien puede publicarlo.</p>
          )}
        </div>
      )}

      <div className="adm-stats">
        {stats.map(([label, value, sub]) => (
          <div key={label} className="adm-card">
            <b>{value}</b>
            <span>{label}</span>
            {sub && <small>{sub}</small>}
          </div>
        ))}
      </div>

      {showDietCard && (
        <div className="adm-card" aria-labelledby="menu-h">
          <h2 id="menu-h">Resumen para el menú</h2>
          {dietCounts.length === 0 && allergyList.length === 0 ? (
            <p className="adm-hint">Aún nadie ha indicado preferencias alimentarias ni alergias.</p>
          ) : (
            <>
              <p className="adm-hint">Cuenta a quienes asisten o aún no responden.</p>
              {dietCounts.length > 0 && (
                <ul className="adm-diet-counts">
                  {dietCounts.map(([d, n]) => <li key={d}><b>{n}</b> {DIET_LABELS[d]}</li>)}
                </ul>
              )}
              {allergyList.length > 0 && (
                <>
                  <h3 className="adm-sub">Alergias y notas ({allergyList.length})</h3>
                  <ul className="adm-plain">
                    {allergyList.map((m) => (
                      <li key={m.id}>
                        <b>{m.name ?? `Lugar de ${guestName.get(m.guest_id) ?? "invitación"}`}</b>{" "}
                        <small className="adm-hint">({guestName.get(m.guest_id)})</small>: {m.allergies}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      )}

      <div className="adm-two">
        <AddGuestForm eventId={event.id} />
        <ImportForm eventId={event.id} />
      </div>

      <nav className="adm-filters" aria-label="Filtrar">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={k === "todos" ? `/app/${event.id}` : `/app/${event.id}?f=${k}`} aria-current={filter === k ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>Invitado</th><th>Pases</th><th>Estado</th><th>Mesa</th><th>Mensaje</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={6}>No hay invitados en esta vista.</td></tr>}
            {visible.map((g) => {
              const url = `${base}/${event.slug}/${g.code}`;
              const invite = `Hola ${g.name}, te invitamos a ${event.title}. Aquí está tu invitación y el link para confirmar tu asistencia: ${url}`;
              const remind = `Hola ${g.name}, te recordamos confirmar tu asistencia a ${event.title}${deadline ? ` antes del ${deadline}` : ""}: ${url}`;
              const phone = g.phone?.replace(/\D/g, "");
              const wa = (text: string) => `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(text)}`;
              return (
                <tr key={g.id}>
                  <td data-label="Invitado">
                    <b>{g.name}</b>
                    <small>{g.code}{g.phone ? ` · ${g.phone}` : ""}</small>
                    <small>{peopleSummary(membersByGuest.get(g.id) ?? [], g.passes)}</small>
                    {(membersByGuest.get(g.id) ?? []).filter((m) => m.attending !== false && dietText(m.diet, m.allergies)).map((m) => (
                      <small key={m.id} className="adm-diet-line">{m.name ?? "Sin nombre"}: {dietText(m.diet, m.allergies)}</small>
                    ))}
                  </td>
                  <td data-label="Pases">{g.passes}</td>
                  <td data-label="Estado">
                    {g.attending === null ? <span className="adm-tag">Pendiente</span>
                      : g.attending ? <span className="adm-tag adm-yes">Asiste · {g.confirmed_count}</span>
                      : <span className="adm-tag adm-no">No asiste</span>}
                  </td>
                  <td data-label="Mesa">{tableSummary(membersByGuest.get(g.id) ?? [], tableName) || "—"}</td>
                  <td data-label="Mensaje">{g.message ?? "—"}</td>
                  <td data-label="Acciones" className="adm-row-actions">
                    <CopyLink url={url} />
                    <a className="adm-link" target="_blank" rel="noopener" href={wa(invite)}>
                      {g.attending === null ? "Invitar" : "WhatsApp"}
                    </a>
                    {g.attending === null && (
                      <a className="adm-link" target="_blank" rel="noopener" href={wa(remind)}>Recordar</a>
                    )}
                    <EditGuest eventId={event.id} guest={{ id: g.id, name: g.name, passes: g.passes, phone: g.phone }} members={membersByGuest.get(g.id) ?? []} askDiet={askDiet} />
                    <DeleteButton id={g.id} eventId={event.id} name={g.name} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(access === "owner" || access === "editor") && (
        <>
          {access === "owner" && (
            <>
              <CollaboratorsCard eventId={event.id} members={collaborators} invites={pendingInvites} />
              <DataDeletionCard eventId={event.id} retentionDate={retentionDate} />
              <SupportCard eventId={event.id} until={supportActive ? event.support_access_until : null} />
            </>
          )}
          {access === "editor" && (
            <p className="adm-hint">Eres colaborador de este evento: puedes editarlo y administrar a los invitados.</p>
          )}
          {activity && activity.length > 0 && (
            <div className="adm-card">
              <h2>Actividad reciente</h2>
              <ul className="adm-plain">
                {activity.map((a) => (
                  <li key={a.id}>
                    <small className="adm-hint">
                      {new Date(a.at).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}
                    </small>{" "}
                    {auditLabel(a.action, (a.details ?? {}) as Record<string, unknown>)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </>
  );
}

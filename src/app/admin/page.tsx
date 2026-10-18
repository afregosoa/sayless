import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireSuperadmin } from "@/lib/auth";
import { EVENT_TYPE_LABELS, type EventType } from "@/lib/event-starter";
import { supabaseUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { AdminNav } from "./admin-nav";
import { EventControls } from "./event-controls";
import { RetentionSwitch } from "./retention-switch";
import { retentionEnabled } from "@/lib/retention";

export const metadata: Metadata = { title: "Operador", robots: { index: false, follow: false } };

export default function AdminPage() {
  return (
    <main className="admin">
      <Suspense fallback={<p>Cargando…</p>}>
        <Overview />
      </Suspense>
    </main>
  );
}

async function Overview() {
  const user = await requireSuperadmin();
  const supabase = await supabaseUser();

  // Metadatos y conteos: sin nombres de invitados (eso requiere el permiso de soporte del cliente).
  const [{ data: events }, { data: profiles }, { data: statsRaw }] = await Promise.all([
    supabase.from("events")
      .select("id, title, slug, type, status, owner_id, paid_at, support_access_until, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, email, is_superadmin"),
    supabase.rpc("event_guest_stats"),
  ]);
  const { data: invites } = await supabaseAdmin().from("owner_invites").select("event_id, email");
  const retention = await retentionEnabled();

  const emailOf = new Map((profiles ?? []).map((p) => [p.id, p.email]));
  const inviteOf = new Map((invites ?? []).map((i) => [i.event_id, i.email]));
  type Stat = { event_id: string; guests: number; answered: number; people: number };
  const statOf = new Map(((statsRaw ?? []) as Stat[]).map((s) => [s.event_id, s]));
  const all = events ?? [];
  const now = new Date();

  const cards: [string, number][] = [
    ["Clientes", (profiles ?? []).filter((p) => !p.is_superadmin).length],
    ["Eventos", all.length],
    ["Publicados", all.filter((e) => e.status === "published").length],
    ["Borradores", all.filter((e) => e.status === "draft").length],
    ["Pagados", all.filter((e) => e.paid_at).length],
    ["Personas confirmadas", [...statOf.values()].reduce((n, s) => n + s.people, 0)],
  ];

  return (
    <>
      <AdminNav email={user.email} current="resumen" />

      <div className="adm-stats">
        {cards.map(([label, value]) => (
          <div key={label} className="adm-card"><b>{value}</b><span>{label}</span></div>
        ))}
      </div>

      <RetentionSwitch enabled={retention} />

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>Evento</th><th>Dueño</th><th>Estado y pago</th><th>Invitados</th><th>Soporte</th></tr>
          </thead>
          <tbody>
            {all.length === 0 && <tr><td colSpan={5}>Sin eventos.</td></tr>}
            {all.map((e) => {
              const s = statOf.get(e.id);
              const support = e.support_access_until && new Date(e.support_access_until) > now;
              return (
                <tr key={e.id}>
                  <td data-label="Evento">
                    <Link href={`/app/${e.id}`}><b>{e.title}</b></Link>
                    <small>/{e.slug} · {EVENT_TYPE_LABELS[e.type as EventType] ?? e.type}</small>
                  </td>
                  <td data-label="Dueño">
                    {e.owner_id
                      ? <Link href={`/admin/clientes/${e.owner_id}`}>{emailOf.get(e.owner_id) ?? "—"}</Link>
                      : inviteOf.get(e.id) ? <>Reservado: {inviteOf.get(e.id)}</> : "Sin dueño"}
                  </td>
                  <td data-label="Estado y pago">
                    <EventControls id={e.id} slug={e.slug} status={e.status} paid={!!e.paid_at} />
                  </td>
                  <td data-label="Invitados">
                    {s ? `${s.guests} (${s.answered} respondieron · ${s.people} personas)` : "0"}
                  </td>
                  <td data-label="Soporte">
                    {support ? <span className="adm-tag adm-yes">Acceso concedido</span> : <span className="adm-hint">Sin acceso</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

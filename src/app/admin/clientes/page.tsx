import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireSuperadmin } from "@/lib/auth";
import { supabaseUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { AdminNav } from "../admin-nav";
import { CreateClientEventForm } from "../create-client-event-form";

export const metadata: Metadata = { title: "Clientes", robots: { index: false, follow: false } };

export default function ClientsPage() {
  return (
    <main className="admin">
      <Suspense fallback={<p>Cargando…</p>}>
        <Clients />
      </Suspense>
    </main>
  );
}

async function Clients() {
  const user = await requireSuperadmin();
  const supabase = await supabaseUser();
  const [{ data: profiles }, { data: events }] = await Promise.all([
    supabase.from("profiles").select("id, email, created_at, is_superadmin").order("created_at", { ascending: false }),
    supabase.from("events").select("id, title, owner_id, paid_at"),
  ]);
  const { data: invites } = await supabaseAdmin().from("owner_invites").select("email, event_id");

  const byOwner = new Map<string, { total: number; paid: number }>();
  for (const e of events ?? []) {
    if (!e.owner_id) continue;
    const c = byOwner.get(e.owner_id) ?? { total: 0, paid: 0 };
    c.total += 1;
    if (e.paid_at) c.paid += 1;
    byOwner.set(e.owner_id, c);
  }
  const titleOf = new Map((events ?? []).map((e) => [e.id, e.title]));
  const clients = (profiles ?? []).filter((p) => !p.is_superadmin);

  return (
    <>
      <AdminNav email={user.email} current="clientes" />

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>Cliente</th><th>Registro</th><th>Eventos</th><th>Pagados</th></tr>
          </thead>
          <tbody>
            {clients.length === 0 && <tr><td colSpan={4}>Aún no hay clientes.</td></tr>}
            {clients.map((p) => {
              const c = byOwner.get(p.id) ?? { total: 0, paid: 0 };
              return (
                <tr key={p.id}>
                  <td data-label="Cliente"><Link href={`/admin/clientes/${p.id}`}><b>{p.email}</b></Link></td>
                  <td data-label="Registro">{new Date(p.created_at).toLocaleDateString("es-MX")}</td>
                  <td data-label="Eventos">{c.total}</td>
                  <td data-label="Pagados">{c.paid}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(invites ?? []).length > 0 && (
        <div className="adm-card">
          <h2>Reservados para quien aún no se registra</h2>
          <ul className="adm-plain">
            {(invites ?? []).map((i) => (
              <li key={`${i.email}-${i.event_id}`}>
                {i.email} → <Link href={`/app/${i.event_id}`}>{titleOf.get(i.event_id) ?? "evento"}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <CreateClientEventForm />
    </>
  );
}

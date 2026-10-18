import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { requireSuperadmin } from "@/lib/auth";
import { EVENT_TYPE_LABELS, type EventType } from "@/lib/event-starter";
import { supabaseUser } from "@/lib/supabase/server";
import { AdminNav } from "../../admin-nav";
import { CreateClientEventForm } from "../../create-client-event-form";
import { EventControls } from "../../event-controls";

export const metadata: Metadata = { title: "Cliente", robots: { index: false, follow: false } };

export default function ClientPage(props: PageProps<"/admin/clientes/[id]">) {
  return (
    <main className="admin">
      <Suspense fallback={<p>Cargando…</p>}>
        <Client params={props.params} />
      </Suspense>
    </main>
  );
}

async function Client({ params }: { params: PageProps<"/admin/clientes/[id]">["params"] }) {
  const user = await requireSuperadmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await supabaseUser();
  const { data: profile } = await supabase.from("profiles").select("id, email, created_at").eq("id", id).maybeSingle();
  if (!profile) notFound();
  const { data: events } = await supabase
    .from("events")
    .select("id, title, slug, type, status, paid_at, event_date, support_access_until")
    .eq("owner_id", id)
    .order("created_at", { ascending: false });
  const now = new Date();

  return (
    <>
      <AdminNav email={user.email} current="clientes" />
      <div>
        <Link href="/admin/clientes" className="adm-hint">← Clientes</Link>
        <h2>{profile.email}</h2>
        <p className="adm-hint">Registrado el {new Date(profile.created_at).toLocaleDateString("es-MX")}</p>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>Evento</th><th>Fecha</th><th>Estado y pago</th><th>Soporte</th></tr></thead>
          <tbody>
            {(events ?? []).length === 0 && <tr><td colSpan={4}>Este cliente aún no tiene eventos.</td></tr>}
            {(events ?? []).map((e) => (
              <tr key={e.id}>
                <td data-label="Evento">
                  <Link href={`/app/${e.id}`}><b>{e.title}</b></Link>
                  <small>/{e.slug} · {EVENT_TYPE_LABELS[e.type as EventType] ?? e.type}</small>
                </td>
                <td data-label="Fecha">{e.event_date ?? "—"}</td>
                <td data-label="Estado y pago">
                  <EventControls id={e.id} slug={e.slug} status={e.status} paid={!!e.paid_at} />
                </td>
                <td data-label="Soporte">
                  {e.support_access_until && new Date(e.support_access_until) > now
                    ? <span className="adm-tag adm-yes">Acceso concedido</span>
                    : <span className="adm-hint">Sin acceso</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreateClientEventForm email={profile.email ?? undefined} />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { EVENT_TYPE_LABELS, type EventType } from "@/lib/event-starter";
import { supabaseUser } from "@/lib/supabase/server";
import { signOut } from "../login/actions";
import { CreateEventForm } from "./create-event-form";

export const metadata: Metadata = { title: "Mis eventos", robots: { index: false, follow: false } };

export default function AppHome(props: PageProps<"/app">) {
  return (
    <main className="admin">
      <Suspense fallback={<p>Cargando…</p>}>
        <Events searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

const STATUS: Record<string, string> = { draft: "Borrador", published: "Publicado", closed: "Cerrado" };

async function Events({ searchParams }: { searchParams: PageProps<"/app">["searchParams"] }) {
  const user = await requireUser();
  const { plantilla } = await searchParams; // preselecciona la plantilla elegida en el catálogo público
  const supabase = await supabaseUser();
  // RLS: un cliente solo recibe sus eventos (el superadmin ve los suyos aquí y todos en /admin).
  // Eventos propios + eventos donde soy colaborador (RLS no devuelve nada más a un cliente).
  const { data: memberships } = await supabase.from("event_members").select("event_id").eq("user_id", user.id);
  const memberIds = (memberships ?? []).map((m) => m.event_id);
  const { data: events } = await supabase
    .from("events")
    .select("id, title, slug, type, status, event_date, owner_id")
    .or(memberIds.length ? `owner_id.eq.${user.id},id.in.(${memberIds.join(",")})` : `owner_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  return (
    <>
      <header className="adm-head">
        <div>
          <h1>Mis eventos</h1>
          <p className="adm-hint">{user.name ? `${user.name} · ` : ""}{user.email}</p>
        </div>
        <div className="adm-actions">
          {user.isSuperadmin && <Link className="adm-btn adm-ghost" href="/admin">Panel admin</Link>}
          <form action={signOut}><button className="adm-btn adm-ghost">Salir</button></form>
        </div>
      </header>

      {events && events.length > 0 ? (
        <div className="adm-events">
          {events.map((e) => (
            <Link key={e.id} href={`/app/${e.id}`} className="adm-card adm-event">
              <b>{e.title}</b>
              <span>{EVENT_TYPE_LABELS[e.type as EventType] ?? e.type}{e.event_date ? ` · ${e.event_date}` : ""}</span>
              <span className="adm-tag">{STATUS[e.status] ?? e.status}</span>
              {e.owner_id !== user.id && <span className="adm-hint">Colaborador</span>}
            </Link>
          ))}
        </div>
      ) : (
        <p className="adm-hint">Aún no tienes eventos. Crea el primero.</p>
      )}

      <CreateEventForm initialTemplate={typeof plantilla === "string" ? plantilla : undefined} />
    </>
  );
}

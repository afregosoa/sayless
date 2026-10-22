import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { eventAccess } from "@/lib/access";
import { auditSupportView } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { contentSchema, formatDay } from "@/lib/event-content";
import { isEventMember } from "@/lib/membership";
import type { QueueGuest } from "@/lib/reminders";
import { siteUrl } from "@/lib/site-url";
import { supabaseUser } from "@/lib/supabase/server";
import { ReminderQueue } from "./reminder-queue";

export const metadata: Metadata = { title: "Recordatorios", robots: { index: false, follow: false } };

export default function Page(props: PageProps<"/app/[id]/recordatorios">) {
  return (
    <main className="admin">
      <Suspense fallback={<p>Cargando…</p>}>
        <Content params={props.params} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: { params: PageProps<"/app/[id]/recordatorios">["params"] }) {
  const user = await requireUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await supabaseUser();
  const { data: event } = await supabase
    .from("events")
    .select("id, title, slug, status, locale, rsvp_deadline, content, owner_id, support_access_until")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();

  const isMember = event.owner_id !== user.id && (await isEventMember(supabase, event.id, user.id));
  const access = eventAccess(user, event, isMember);
  if (access === "readonly") {
    return (
      <div className="adm-card">
        <h2>Acceso restringido</h2>
        <p>Solo el dueño, sus colaboradores o soporte (con permiso del dueño) pueden enviar recordatorios.</p>
        <Link href="/admin" className="adm-link">← Volver</Link>
      </div>
    );
  }
  if (access === "support") await auditSupportView(user.id, event.id);

  const back = <Link href={`/app/${event.id}`} className="adm-hint">← {event.title}</Link>;

  // Los enlaces personales solo funcionan con la invitación publicada: antes, enviarlos llevaría a una pantalla de "aún no publicada".
  if (event.status === "draft") {
    return (
      <>
        <header className="adm-head"><div>{back}<h1>Recordatorios</h1></div></header>
        <div className="adm-card">
          <h2>Publica tu invitación primero</h2>
          <p>Los enlaces personales de los invitados solo funcionan cuando la invitación está publicada. Cuando la publiques, aquí podrás enviarles su invitación y recordatorios por WhatsApp.</p>
          <Link href={`/app/${event.id}`} className="adm-link">Ir al evento →</Link>
        </div>
      </>
    );
  }

  const [{ data: guestRows, error }, { data: contactRows }] = await Promise.all([
    supabase.from("guests")
      .select("id, name, code, phone, attending, open_count, last_opened_at")
      .eq("event_id", event.id)
      .is("anonymized_at", null)
      .order("name"),
    supabase.from("guest_contacts").select("guest_id, created_at").eq("event_id", event.id).order("created_at", { ascending: false }),
  ]);
  if (error) {
    console.error("No se pudieron cargar los invitados para recordatorios", error.message);
    return (
      <div className="adm-card">
        <h2>No se pudo cargar la lista</h2>
        <p className="adm-err">Revisa que la base de datos tenga aplicadas las migraciones 020 y 021 e intenta de nuevo.</p>
        <Link href={`/app/${event.id}`} className="adm-link">← Volver al evento</Link>
      </div>
    );
  }

  const byGuest = new Map<string, { count: number; last: string }>();
  for (const c of contactRows ?? []) {
    const cur = byGuest.get(c.guest_id);
    if (cur) cur.count += 1;
    else byGuest.set(c.guest_id, { count: 1, last: c.created_at }); // viene ordenado: el primero es el más reciente
  }
  const guests: QueueGuest[] = (guestRows ?? []).map((g) => ({
    id: g.id, name: g.name, code: g.code, phone: g.phone, attending: g.attending,
    openCount: g.open_count ?? 0, lastOpenedAt: g.last_opened_at,
    contactCount: byGuest.get(g.id)?.count ?? 0, lastContactAt: byGuest.get(g.id)?.last ?? null,
  }));

  const content = contentSchema.safeParse(event.content);
  const publicTitle = ((content.success && content.data.hero.title) || event.title).replace(/\s*\n\s*/g, " ").trim();

  return (
    <>
      <header className="adm-head">
        <div>
          {back}
          <h1>Recordatorios por WhatsApp</h1>
          <p className="adm-hint">Una cola para avisar a quienes aún no confirman. Se abre cada chat con el mensaje listo; tú pulsas enviar en WhatsApp.</p>
        </div>
      </header>
      <ReminderQueue
        eventId={event.id}
        slug={event.slug}
        base={await siteUrl()}
        eventTitle={publicTitle}
        deadlineLabel={event.rsvp_deadline ? formatDay(event.rsvp_deadline, event.locale) : null}
        guests={guests}
        nowMs={Date.now()}
      />
    </>
  );
}

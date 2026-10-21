import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { eventAccess } from "@/lib/access";
import { isEventMember } from "@/lib/membership";
import { requireUser } from "@/lib/auth";
import { contentSchema, themeSchema } from "@/lib/event-content";
import { DEFAULT_THEME, starterContent, type EventType } from "@/lib/event-starter";
import { supabaseUser } from "@/lib/supabase/server";
import { isTemplateId } from "@/templates/catalog";
import { Editor } from "./editor";

export const metadata: Metadata = { title: "Editar invitación", robots: { index: false, follow: false } };

export default function Page(props: PageProps<"/app/[id]/editar">) {
  return (
    <main className="admin admin-wide">
      <Suspense fallback={<p>Cargando…</p>}>
        <Load params={props.params} />
      </Suspense>
    </main>
  );
}

async function Load({ params }: { params: PageProps<"/app/[id]/editar">["params"] }) {
  const user = await requireUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await supabaseUser();
  const { data: event } = await supabase
    .from("events")
    .select("id, title, slug, type, status, template, event_date, rsvp_deadline, content, theme, owner_id, support_access_until")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();

  const isMember = event.owner_id !== user.id && (await isEventMember(supabase, event.id, user.id));
  if (eventAccess(user, event, isMember) === "readonly") {
    return (
      <div className="adm-card">
        <h2>Acceso restringido</h2>
        <p>Solo el dueño y sus colaboradores pueden editar este evento, o soporte si el dueño le da acceso temporal.</p>
        <Link href="/admin" className="adm-link">← Volver</Link>
      </div>
    );
  }

  // Si el contenido guardado no cumple el esquema, se parte del contenido inicial.
  const content = contentSchema.safeParse(event.content);
  const theme = themeSchema.safeParse(event.theme);

  return (
    <>
      <header className="adm-head">
        <div>
          <Link href={`/app/${event.id}`} className="adm-hint">← {event.title}</Link>
          <h1>Editar invitación</h1>
        </div>
      </header>
      <Editor
        eventId={event.id}
        eventType={event.type as EventType}
        initial={{
          template: isTemplateId(event.template) ? event.template : "editorial",
          title: event.title,
          eventDate: event.event_date,
          rsvpDeadline: event.rsvp_deadline,
          content: content.success ? content.data : starterContent(event.title, event.type as EventType),
          theme: theme.success ? theme.data : DEFAULT_THEME,
        }}
        publicPath={`/${event.slug}`}
        isPublished={event.status !== "draft"}
      />
    </>
  );
}

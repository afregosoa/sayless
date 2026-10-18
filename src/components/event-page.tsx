import { notFound } from "next/navigation";
import { lookupGuest } from "@/app/actions";
import { getPublicEvent } from "@/lib/events";
import { Invitation } from "./invitation";

export async function EventPage({ slug, code }: { slug: string; code?: string }) {
  const event = await getPublicEvent(slug);
  if (!event) notFound();

  // Código inválido: se muestra la invitación normal pidiendo el código.
  const guest = code ? await lookupGuest(slug, code) : null;
  return <Invitation event={event} code={guest ? code?.toUpperCase() : undefined} guest={guest ?? undefined} />;
}

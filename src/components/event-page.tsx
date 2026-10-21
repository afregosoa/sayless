import { notFound } from "next/navigation";
import { lookupGuest } from "@/app/actions";
import { InvitationUnavailable } from "./invitation-unavailable";
import { getPublicEvent, getUnavailableReason } from "@/lib/events";
import { Invitation } from "./invitation";

export async function EventPage({ slug, code }: { slug: string; code?: string }) {
  const event = await getPublicEvent(slug);
  if (!event) {
    // Un borrador (o un contenido ilegible) explica su razón; solo una dirección que no existe es un 404.
    const reason = await getUnavailableReason(slug);
    if (reason === "missing") notFound();
    return <InvitationUnavailable reason={reason} />;
  }

  // Código inválido: se muestra la invitación normal pidiendo el código.
  const found = code ? await lookupGuest(slug, code) : null;
  const guest = found === "limitado" ? null : found; // bloqueado por intentos fallidos: se ve la invitación general
  return <Invitation event={event} code={guest ? code?.toUpperCase() : undefined} guest={guest ?? undefined} />;
}

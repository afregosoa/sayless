import Link from "next/link";

// Pantalla para cuando una invitación no se puede mostrar. Explica la razón en vez de un 404 genérico.
// No muestra ningún dato del evento: quien abre el enlace solo sabe que existe y por qué aún no está disponible.
const COPY = {
  draft: {
    eyebrow: "Invitación en preparación",
    title: "Esta invitación aún no está publicada",
    body: "Quien la creó todavía no la ha publicado, por eso no se puede ver. Cuando esté lista, este mismo enlace funcionará.",
    guest: "Si te invitaron, vuelve a intentarlo más tarde o escribe a quien te envió el enlace.",
    host: "¿Eres el anfitrión? Entra a tu panel, termina de preparar la invitación y publícala.",
  },
  unreadable: {
    eyebrow: "Invitación no disponible",
    title: "No pudimos mostrar esta invitación",
    body: "Hay un problema con su contenido y por ahora no se puede abrir.",
    guest: "Si te invitaron, escribe a quien te envió el enlace para avisarle.",
    host: "¿Eres el anfitrión? Revisa la invitación en el editor de tu panel.",
  },
} as const;

export function InvitationUnavailable({ reason }: { reason: keyof typeof COPY }) {
  const c = COPY[reason];
  return (
    <div className="na">
      <p className="eyebrow">{c.eyebrow}</p>
      <h1>{c.title}</h1>
      <p>{c.body}</p>
      <p className="na-hint">{c.guest}</p>
      <p className="na-host">{c.host}</p>
      <Link href="/app" className="btn ghost">Ir a mi panel</Link>
    </div>
  );
}

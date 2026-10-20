import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Términos de uso",
  description: "Condiciones de uso de SayLess, incluida la declaración de derechos sobre la música de las invitaciones.",
};

// IMPORTANTE: borrador redactado para el lanzamiento. Debe revisarlo un abogado antes de depender de él
// (en especial las secciones 4 y 5, sobre derechos de autor y retiro de contenido).
const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
const UPDATED = "18 de octubre de 2026";

export default function Terms() {
  return (
    <main className="legal">
      <Link href="/" className="legal-back">← SayLess</Link>
      <h1>Términos de uso</h1>
      <p className="legal-date">Última actualización: {UPDATED}</p>

      <h2>1. El servicio</h2>
      <p>
        SayLess permite crear invitaciones digitales para eventos, recibir confirmaciones de asistencia (RSVP) y
        administrar una lista de invitados. Al crear una cuenta o usar el servicio aceptas estos términos.
      </p>

      <h2>2. Tu cuenta y tu contenido</h2>
      <p>
        Eres responsable de la cuenta y de todo lo que publiques en tus invitaciones: textos, fotografías, música y los datos
        de las personas que invites. Declaras que tienes derecho a usar ese contenido y que no infringe derechos de terceros.
      </p>

      <h2>3. Pago</h2>
      <p>
        Puedes preparar tu invitación sin costo. El pago es único por evento y se cobra al publicarla, al precio mostrado
        antes de pagar.
      </p>

      <h2 id="musica">4. Música en las invitaciones</h2>
      <p>
        Puedes agregar a tu invitación un archivo de música (MP3) que tú subes. SayLess no proporciona ni licencia música.
        Al subir un archivo y marcar la declaración correspondiente, afirmas que:
      </p>
      <ul>
        <li>eres titular de los derechos de esa música, o cuentas con la licencia o autorización necesaria para usarla y
          reproducirla públicamente en tu invitación;</li>
        <li>entiendes que la invitación puede ser abierta por todas las personas que reciban el enlace, y que el archivo se
          aloja en nuestros servidores para poder reproducirse;</li>
        <li>eres el único responsable de cualquier reclamación de terceros relacionada con esa música, y mantendrás a SayLess
          libre de responsabilidad frente a ella, en la medida que permita la ley.</li>
      </ul>
      <p>
        Nos otorgas una licencia limitada, no exclusiva y revocable para alojar y reproducir ese archivo únicamente con el fin de
        mostrar tu invitación. La fecha en que aceptaste esta declaración queda registrada en tu evento.
      </p>

      <h2>5. Reclamaciones y retiro de contenido</h2>
      <p>
        Si eres titular de derechos y crees que una invitación usa tu obra sin autorización, escríbenos
        {CONTACT ? <> a <a href={`mailto:${CONTACT}`}>{CONTACT}</a></> : " al correo de contacto de SayLess"} indicando la obra,
        la dirección de la invitación y tus datos de contacto. Podemos retirar o desactivar la música (o la invitación completa)
        sin previo aviso mientras se revisa la reclamación, y suspender cuentas con reclamaciones repetidas.
      </p>

      <h2>6. Uso aceptable</h2>
      <p>
        No puedes usar SayLess para contenido ilegal, engañoso u ofensivo, ni para enviar mensajes no solicitados. Podemos
        suspender o retirar contenido que incumpla estos términos.
      </p>

      <h2>7. Disponibilidad y responsabilidad</h2>
      <p>
        Hacemos lo posible por que el servicio funcione sin interrupciones, pero se ofrece “tal cual”. En la medida que la
        ley lo permita, la responsabilidad de SayLess se limita al monto pagado por el evento afectado.
      </p>

      <h2>8. Cambios</h2>
      <p>
        Podemos actualizar estos términos. Si el cambio es importante, lo avisaremos en el servicio. Seguir usándolo después
        significa que lo aceptas.
      </p>
    </main>
  );
}

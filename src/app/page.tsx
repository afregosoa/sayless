import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EventShowcase } from "@/components/landing/event-showcase";
import { Logo } from "@/components/landing/logo";
import { Reveal } from "@/components/landing/reveal";
import { SignupForm } from "@/components/landing/signup-form";
import { Volcano } from "@/components/landing/volcano";
import { getCurrentUser } from "@/lib/auth";
import { getPriceLabel } from "@/lib/pricing";

export const metadata: Metadata = {
  title: { absolute: "SayLess · Invitaciones digitales con confirmación de asistencia" },
  description:
    "Crea la invitación digital de tu boda, XV años, bautizo o cumpleaños. Confirmación de asistencia (RSVP), lista de invitados, recordatorios por WhatsApp y en español o inglés. Pago único por evento.",
};

const FEATURES: { title: string; text: string; soon?: boolean }[] = [
  { title: "Invitación digital", text: "Una página elegante con fecha, lugar, itinerario y cuenta regresiva, lista para compartir por enlace." },
  { title: "Confirmación de asistencia", text: "Cada invitado confirma desde su enlace personal: si asiste, cuántos lugares usa y un mensaje para ti." },
  { title: "Lista de invitados", text: "Carga tu lista, mira en tiempo real quién respondió y cuántas personas serán, y descarga todo en CSV." },
  { title: "Recordatorios por WhatsApp", text: "Envía a cada invitado su enlace y recuérdales confirmar con un mensaje listo para mandar." },
  { title: "Español e inglés", text: "Cada invitado ve la invitación en su idioma. Ideal para familias con invitados de ambos lados." },
  { title: "Plantillas personalizables", text: "Elige una plantilla y adáptala: textos, fotos, colores y secciones, hasta que sea tuya." },
  { title: "Orden de invitados por mesa", text: "Acomoda a tus invitados en mesas y comparte el plano con tu equipo.", soon: true },
  { title: "Conexión con tu wedding planner", text: "Tu planeador accede a la información del evento para coordinar todo en un solo lugar.", soon: true },
];

const STEPS = [
  { n: "1", title: "Crea tu cuenta", text: "Con tu correo y una contraseña, o con tu cuenta de Google. Toma menos de un minuto." },
  { n: "2", title: "Diseña tu invitación", text: "Elige plantilla, personaliza el contenido y agrega a tus invitados. Es gratis mientras armas todo." },
  { n: "3", title: "Publica y comparte", text: "Cuando todo esté listo, pagas una sola vez y envías los enlaces a tus invitados." },
];

const FAQ = [
  { q: "¿Cuánto cuesta?", a: "Es un pago único por evento, sin mensualidades. Puedes armar y revisar tu invitación sin pagar; el cobro se hace al publicarla." },
  { q: "¿Mis invitados necesitan crear una cuenta?", a: "No. Cada invitado recibe un enlace personal y confirma desde su celular en segundos." },
  { q: "¿Puedo tener la invitación en inglés?", a: "Sí. Puedes ofrecer la invitación en español e inglés, y cada invitado la ve en su idioma." },
  { q: "¿Qué pasa con los datos de mis invitados?", a: "Son tuyos. Solo tú y las personas que invites a colaborar pueden verlos. Pasado el evento, los datos personales se anonimizan." },
  { q: "¿Para qué tipo de eventos sirve?", a: "Bodas, XV años, bautizos, cumpleaños y cualquier otro evento con lista de invitados." },
];

export default function Home() {
  const live = FEATURES.filter((f) => !f.soon);
  const soon = FEATURES.filter((f) => f.soon);
  return (
    <div className="lp">
      <section className="lp-hero">
        <div className="lp-hero-bg" aria-hidden="true" />
        <header className="lp-nav">
          <Link href="/" className="lp-logo" aria-label="SayLess, inicio"><Logo variant="on-dark" height={40} /></Link>
          <nav aria-label="Principal">
            <a href="#funciones">Funciones</a>
            <a href="#precio">Precio</a>
            <a href="#faq">Preguntas</a>
            <Suspense fallback={<Link href="/login" className="lp-btn lp-btn-sm lp-btn-light">Entrar</Link>}>
              <NavAccount />
            </Suspense>
          </nav>
        </header>
        <div className="lp-hero-copy">
          <p className="lp-eyebrow">Invitaciones digitales · RSVP</p>
          <h1>Di menos.<br /><em>Celebra más.</em></h1>
          <p className="lp-lead">
            La invitación de tu boda, XV años, bautizo o cumpleaños, con confirmación de asistencia,
            lista de invitados y recordatorios por WhatsApp. Todo en un solo lugar.
          </p>
          <div className="lp-cta">
            <a href="#empezar" className="lp-btn lp-btn-light">Crear mi invitación</a>
            <a href="#funciones" className="lp-link">Ver qué incluye</a>
          </div>
        </div>
      </section>

      <main>
        <section className="lp-section lp-showcase" aria-labelledby="asi">
          <Reveal>
            <p className="lp-eyebrow">Así se ve</p>
            <h2 id="asi">Una invitación para cada celebración</h2>
            <p className="lp-sub">Elige el tipo de evento y mira cómo la recibirían tus invitados en el celular.</p>
          </Reveal>
          <EventShowcase />
        </section>

        <section id="funciones" className="lp-section">
          <Reveal>
            <p className="lp-eyebrow">Funciones</p>
            <h2>Todo lo que necesitas<br />para tu evento</h2>
          </Reveal>
          <ol className="lp-list">
            {live.map((f, n) => (
              <li key={f.title}>
                <Reveal className="lp-row">
                  <span className="lp-num">{String(n + 1).padStart(2, "0")}</span>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </Reveal>
              </li>
            ))}
          </ol>
          <Reveal className="lp-soon-box">
            <p className="lp-eyebrow">Próximamente</p>
            <ul>
              {soon.map((f) => (
                <li key={f.title}>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        <section className="lp-section" aria-labelledby="como">
          <Reveal>
            <p className="lp-eyebrow">Cómo funciona</p>
            <h2 id="como">Tres pasos y listo</h2>
          </Reveal>
          <ol className="lp-steps">
            {STEPS.map((s, n) => (
              <li key={s.n}>
                <Reveal delay={n * 90}>
                  <span className="lp-step-n">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        <section id="precio" className="lp-section lp-price">
          <Reveal>
            <p className="lp-eyebrow">Precio</p>
            <h2>Un precio, sin sorpresas</h2>
          </Reveal>
          <Reveal className="lp-price-card">
            <p className="lp-price-amount">
              <Suspense fallback="$899 MXN"><Price /></Suspense>
            </p>
            <p className="lp-price-note">pago único por evento</p>
            <ul>
              <li>Invitación digital con plantillas personalizables</li>
              <li>Confirmación de asistencia (RSVP)</li>
              <li>Lista de invitados y exportación a CSV</li>
              <li>Recordatorios por WhatsApp</li>
              <li>Español e inglés</li>
            </ul>
            <p className="lp-small">Armas tu invitación gratis. Solo pagas cuando decides publicarla.</p>
            <a href="#empezar" className="lp-btn">Empezar gratis</a>
          </Reveal>
        </section>

        <section id="faq" className="lp-section">
          <Reveal>
            <p className="lp-eyebrow">Preguntas</p>
            <h2>Preguntas frecuentes</h2>
          </Reveal>
          <div className="lp-faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="empezar" className="lp-final">
          <Volcano className="lp-final-volcano" />
          <Reveal className="lp-final-body">
            <h2>Empieza tu invitación hoy</h2>
            <p className="lp-sub">Crea tu cuenta con tu correo y arma tu evento en minutos.</p>
            <Suspense fallback={null}>
              <FinalCta />
            </Suspense>
          </Reveal>
        </section>
      </main>

      <footer className="lp-footer">
        <Logo height={32} />
        <span>Invitaciones digitales con RSVP</span>
        <span><Link href="/terminos">Términos</Link> · <Link href="/login">Entrar</Link></span>
      </footer>
    </div>
  );
}

async function Price() {
  return (await getPriceLabel()) ?? "$899 MXN";
}

async function NavAccount() {
  const user = await getCurrentUser();
  return user
    ? <Link href="/app" className="lp-btn lp-btn-sm lp-btn-light">Mis eventos</Link>
    : <Link href="/login" className="lp-btn lp-btn-sm lp-btn-light">Entrar</Link>;
}

// Con sesión activa no tiene sentido pedir el correo: lleva directo al panel.
async function FinalCta() {
  const user = await getCurrentUser();
  return user
    ? <Link href="/app" className="lp-btn">Ir a mis eventos</Link>
    : <SignupForm />;
}

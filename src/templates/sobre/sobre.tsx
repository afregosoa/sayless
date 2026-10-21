import Image from "next/image";
import { AddToCalendar } from "@/components/add-to-calendar";
import { Countdown } from "@/components/countdown";
import { Reveal } from "@/components/landing/reveal";
import { flatTitle, galleryImages, heroImage, Lines, mapsHref, MusicSlot, on, RsvpSlot } from "../shared";
import type { TemplateProps } from "../types";
import "../reset.css";
import "./sobre.css";
import { Envelope } from "./envelope";
import { sobreFonts } from "./fonts";

// Adorno: línea con un pequeño ramo en el centro.
function Flourish() {
  return (
    <svg className="so-flourish" viewBox="0 0 240 24" aria-hidden="true">
      <path d="M0 12h92M148 12h92" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M120 3c-6 5-6 13 0 18 6-5 6-13 0-18zM104 12c6-6 12-6 16 0-4 6-10 6-16 0zM136 12c-6-6-12-6-16 0 4 6 10 6 16 0z" fill="currentColor" />
    </svg>
  );
}

function Title({ eyebrow, children, id }: { eyebrow?: string; children: React.ReactNode; id?: string }) {
  return (
    <header className="so-title">
      {eyebrow && <p className="so-eyebrow">{eyebrow}</p>}
      <h2 id={id}>{children}</h2>
      <Flourish />
    </header>
  );
}

const initials = (title: string) =>
  title.split(/\s*(?:&|\by\b|\+)\s*/i).map((n) => n.trim().charAt(0).toUpperCase()).filter(Boolean).join("&");

// Plantilla "Sobre y sello": un sobre con sello de lacre que se abre, y una invitación romántica en dorado y rosa.
export function Sobre({ event, code, guest, preview }: TemplateProps) {
  const c = event.content;
  const title = flatTitle(event);
  const photo = heroImage(event);
  const photos = galleryImages(event);
  const hasMusic = !!c.music?.enabled && !!c.music.path;
  const seal = (c.footer?.monogram?.replace(/\s*\|\s*/g, "&").replace(/\s+/g, "") || initials(title) || "♥").slice(0, 6);

  return (
    <div className={`tpl t-sobre ${sobreFonts}`}>
      <Envelope title={title} date={c.hero.date_label} seal={seal} hasMusic={hasMusic} />
      <MusicSlot event={event} preview={preview} cover={false} />

      <div className="so-wrap">
        <header className="so-hero">
          <nav className="so-nav" aria-label="Secciones">
            {on(c.venues) && <a href="#lugares">Lugares</a>}
            {on(c.schedule) && <a href="#itinerario">Itinerario</a>}
            {on(c.dress_code) && <a href="#vestimenta">Vestimenta</a>}
            <a href="#rsvp">Confirmar</a>
            {on(c.faq) && <a href="#preguntas">Preguntas</a>}
          </nav>
          <p className="so-eyebrow">Nos casamos</p>
          <h1 className="so-names"><Lines text={c.hero.title || event.title} /></h1>
          <Flourish />
          {c.hero.date_label && <p className="so-date">{c.hero.date_label}</p>}
          {c.hero.subtitle && <p className="so-place">{c.hero.subtitle}</p>}
          {photo && (
            <div className="so-oval">
              <Image src={photo} alt={c.hero.image_alt} width={720} height={900} sizes="(max-width: 600px) 80vw, 360px" priority />
            </div>
          )}
          {event.calendar && <AddToCalendar cal={event.calendar} slug={event.slug} className="so-btn" />}
        </header>

        {on(c.welcome) && (
          <Reveal>
            <section className="so-sec so-welcome" aria-labelledby="bienvenida">
              <Title eyebrow={c.welcome.eyebrow} id="bienvenida">
                <Lines text={c.welcome.heading} />
                {c.welcome.heading_script && <span className="so-script"> {c.welcome.heading_script}</span>}
              </Title>
              {c.welcome.body && <p className="so-text">{c.welcome.body}</p>}
              {c.welcome.quote && <blockquote className="so-quote">{c.welcome.quote}</blockquote>}
            </section>
          </Reveal>
        )}

        {on(c.countdown) && event.countdownTarget !== null && (
          <Reveal>
            <section className="so-sec" aria-labelledby="faltan">
              <Title eyebrow="Faltan" id="faltan"><span className="so-script">cada día más cerca</span></Title>
              <Countdown target={event.countdownTarget} className="so-cd" />
              {c.countdown.date_label && <p className="so-note">{c.countdown.date_label}</p>}
            </section>
          </Reveal>
        )}

        {photos.length > 0 && (
          <Reveal>
            <section className="so-sec" aria-labelledby="galeria-h">
              <Title eyebrow="Nuestra historia" id="galeria-h">Algunos <span className="so-script">momentos</span></Title>
              <ul className="so-gallery">
                {photos.map((img, i) => (
                  <li key={img.src} style={{ ["--tilt" as string]: `${i % 2 ? 2 : -2}deg` }}>
                    <Image src={img.src} alt={img.alt} width={600} height={600} sizes="(max-width: 600px) 45vw, 260px" loading={i < 2 ? "eager" : "lazy"} />
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>
        )}

        {on(c.venues) && c.venues.items.length > 0 && (
          <Reveal>
            <section id="lugares" className="so-sec" aria-labelledby="lugares-h">
              <Title eyebrow={c.venues.eyebrow || "Dónde y cuándo"} id="lugares-h">Fecha <span className="so-script">y lugar</span></Title>
              <div className="so-venues">
                {c.venues.items.map((v, i) => (
                  <article className="so-card-box" key={i}>
                    {v.label && <p className="so-eyebrow">{v.label}</p>}
                    <h3>{v.name}</h3>
                    {v.time && <p className="so-time">{v.time}</p>}
                    {v.address && <p className="so-addr">{v.address}</p>}
                    {v.map_query && <a className="so-link" href={mapsHref(v.map_query)} target="_blank" rel="noopener">Cómo llegar</a>}
                  </article>
                ))}
              </div>
            </section>
          </Reveal>
        )}

        {on(c.schedule) && c.schedule.items.length > 0 && (
          <Reveal>
            <section id="itinerario" className="so-sec" aria-labelledby="itin-h">
              <Title eyebrow="El día" id="itin-h">Itinerario <span className="so-script">del día</span></Title>
              <ol className="so-timeline">
                {c.schedule.items.map((it, i) => (
                  <li key={i}><time>{it.time}</time><span className="so-dot" aria-hidden="true" /><span>{it.label}</span></li>
                ))}
              </ol>
            </section>
          </Reveal>
        )}

        {on(c.dress_code) && (
          <Reveal>
            <section id="vestimenta" className="so-sec" aria-labelledby="dress-h">
              <Title eyebrow="Vestimenta" id="dress-h">Código <span className="so-script">de vestimenta</span></Title>
              {c.dress_code.body && <p className="so-text">{c.dress_code.body}</p>}
              {c.dress_code.quote && <blockquote className="so-quote">{c.dress_code.quote}</blockquote>}
            </section>
          </Reveal>
        )}

        {on(c.gifts) && (
          <Reveal>
            <section className="so-sec" aria-labelledby="regalos-h">
              <Title eyebrow="Con cariño" id="regalos-h">Mesa <span className="so-script">de regalos</span></Title>
              {c.gifts.body && <p className="so-text">{c.gifts.body}</p>}
              {c.gifts.url && <p className="so-center"><a className="so-btn" href={c.gifts.url} target="_blank" rel="noopener">{c.gifts.button_label || "Ver mesa de regalos"}</a></p>}
            </section>
          </Reveal>
        )}

        {on(c.lodging) && c.lodging.items.length > 0 && (
          <Reveal>
            <section id="hospedaje" className="so-sec" aria-labelledby="hosp-h">
              <Title eyebrow="Si vienes de fuera" id="hosp-h">Dónde <span className="so-script">hospedarte</span></Title>
              <div className="so-venues">
                {c.lodging.items.map((h, i) => (
                  <article className="so-card-box" key={i}>
                    <h3>{h.name}</h3>
                    {h.address && <p className="so-addr">{h.address}</p>}
                  </article>
                ))}
              </div>
            </section>
          </Reveal>
        )}

        <Reveal>
          <section id="rsvp" className="so-sec so-rsvp" aria-labelledby="rsvp-h">
            <Title eyebrow={event.deadlineLabel && event.status === "published" ? `Confirma antes del ${event.deadlineLabel}` : "Confirmación"} id="rsvp-h">
              ¿Nos <span className="so-script">acompañas?</span>
            </Title>
            <RsvpSlot event={event} code={code} guest={guest} />
          </section>
        </Reveal>

        {on(c.faq) && c.faq.items.length > 0 && (
          <Reveal>
            <section id="preguntas" className="so-sec" aria-labelledby="faq-h">
              <Title eyebrow="Por si te lo preguntas" id="faq-h">Preguntas <span className="so-script">frecuentes</span></Title>
              <div className="so-faq-list">
                {c.faq.items.map((f, i) => (
                  <details key={i} className="so-faq"><summary>{f.q}</summary><p>{f.a}</p></details>
                ))}
              </div>
            </section>
          </Reveal>
        )}

        {c.footer && (
          <footer className="so-footer">
            <Flourish />
            {c.footer.monogram && <p className="so-mono">{c.footer.monogram}</p>}
            {c.footer.line && <p className="so-eyebrow">{c.footer.line}</p>}
          </footer>
        )}
      </div>
    </div>
  );
}

import Image from "next/image";
import { AddToCalendar } from "@/components/add-to-calendar";
import { Countdown } from "@/components/countdown";
import { Reveal } from "@/components/landing/reveal";
import { galleryImages, heroImage, Lines, mapsHref, MusicSlot, on, RsvpSlot } from "../shared";
import type { TemplateProps } from "../types";
import "../reset.css";
import "./jardin.css";
import { Branch, Leaf, LeafDivider } from "./botanical";
import { jardinFonts } from "./fonts";

// El "&" va en el color de acento.
function Names({ text }: { text: string }) {
  return text.split("\n").map((line, i) => (
    <span key={i} className="jd-line">
      {line.split(/(&)/).map((part, k) => (part === "&" ? <i key={k}>&amp;</i> : part))}
    </span>
  ));
}

function Heading({ eyebrow, children, id, light }: { eyebrow?: string; children: React.ReactNode; id?: string; light?: boolean }) {
  return (
    <header className={`jd-title${light ? " is-light" : ""}`}>
      {eyebrow && <p className="jd-eyebrow">{eyebrow}</p>}
      <h2 id={id}>{children}</h2>
      <LeafDivider className="jd-divider" />
    </header>
  );
}

// Plantilla "Jardín": ilustración botánica, fotos en arco y verde salvia.
export function Jardin({ event, code, guest, preview }: TemplateProps) {
  const c = event.content;
  const photo = heroImage(event);
  const photos = galleryImages(event);

  return (
    <div className={`tpl t-jardin ${jardinFonts}`}>
      <MusicSlot event={event} preview={preview} />

      <header className="jd-hero">
        <Branch className="jd-br jd-br-l" leaves={9} variant={0} />
        <Branch className="jd-br jd-br-r" leaves={9} variant={1} flip />

        <nav className="jd-nav" aria-label="Secciones">
          {on(c.venues) && <a href="#lugares">Lugares</a>}
          {on(c.schedule) && <a href="#itinerario">Itinerario</a>}
          {on(c.dress_code) && <a href="#vestimenta">Vestimenta</a>}
          <a href="#rsvp">Confirmar</a>
          {on(c.faq) && <a href="#preguntas">Preguntas</a>}
        </nav>

        <p className="jd-eyebrow">Nos casamos</p>
        <h1 className="jd-names"><Names text={c.hero.title || event.title} /></h1>

        <div className="jd-arch">
          {photo ? (
            <Image src={photo} alt={c.hero.image_alt} width={680} height={900} sizes="(max-width: 600px) 80vw, 340px" priority />
          ) : (
            <Branch className="jd-arch-art" leaves={10} variant={2} />
          )}
        </div>

        {c.hero.date_label && <p className="jd-date">{c.hero.date_label}</p>}
        {c.hero.subtitle && <p className="jd-place">{c.hero.subtitle}</p>}
        {event.calendar && <AddToCalendar cal={event.calendar} slug={event.slug} className="jd-btn" />}
      </header>

      <div className="jd-wrap">
        {on(c.welcome) && (
          <Reveal>
            <section className="jd-sec jd-center" aria-labelledby="bienvenida">
              <Heading eyebrow={c.welcome.eyebrow} id="bienvenida">
                <Lines text={c.welcome.heading} />{c.welcome.heading_script && <> <em>{c.welcome.heading_script}</em></>}
              </Heading>
              {c.welcome.body && <p className="jd-text">{c.welcome.body}</p>}
              {c.welcome.quote && <blockquote className="jd-quote">{c.welcome.quote}</blockquote>}
            </section>
          </Reveal>
        )}
      </div>

      {on(c.countdown) && event.countdownTarget !== null && (
        <div className="jd-band jd-band-accent tpl-bleed">
          <Reveal>
            <section className="jd-wrap jd-sec jd-center" aria-labelledby="faltan">
              <Heading eyebrow="Faltan" id="faltan" light>Cuenta <em>regresiva</em></Heading>
              <Countdown target={event.countdownTarget} className="jd-cd" />
              {c.countdown.date_label && <p className="jd-note">{c.countdown.date_label}</p>}
            </section>
          </Reveal>
        </div>
      )}

      <div className="jd-wrap">
        {photos.length > 0 && (
          <Reveal>
            <section className="jd-sec jd-center" aria-labelledby="galeria-h">
              <Heading eyebrow="Nuestra historia" id="galeria-h">Algunos <em>momentos</em></Heading>
              <ul className="jd-gallery">
                {photos.map((img, i) => (
                  <li key={img.src}>
                    <Image src={img.src} alt={img.alt} width={600} height={i === 0 ? 800 : 600} sizes="(max-width: 600px) 45vw, 240px" loading={i < 2 ? "eager" : "lazy"} />
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>
        )}
      </div>

      {on(c.venues) && c.venues.items.length > 0 && (
        <div className="jd-band tpl-bleed">
          <Reveal>
            <section id="lugares" className="jd-wrap jd-sec jd-center" aria-labelledby="lugares-h">
              <Heading eyebrow={c.venues.eyebrow || "Dónde y cuándo"} id="lugares-h">Fecha <em>y lugar</em></Heading>
              <div className="jd-venues">
                {c.venues.items.map((v, i) => (
                  <article className="jd-arch-card" key={i}>
                    <Leaf className="jd-leaf" />
                    {v.label && <p className="jd-eyebrow">{v.label}</p>}
                    <h3>{v.name}</h3>
                    {v.time && <p className="jd-time">{v.time}</p>}
                    {v.address && <p className="jd-addr">{v.address}</p>}
                    {v.map_query && <a className="jd-link" href={mapsHref(v.map_query)} target="_blank" rel="noopener">Cómo llegar</a>}
                  </article>
                ))}
              </div>
            </section>
          </Reveal>
        </div>
      )}

      <div className="jd-wrap">
        {on(c.schedule) && c.schedule.items.length > 0 && (
          <Reveal>
            <section id="itinerario" className="jd-sec" aria-labelledby="itin-h">
              <Heading eyebrow="El día" id="itin-h">Itinerario <em>del día</em></Heading>
              <ol className="jd-timeline">
                {c.schedule.items.map((it, i) => (
                  <li key={i}><Leaf className="jd-leaf" /><time>{it.time}</time><span>{it.label}</span></li>
                ))}
              </ol>
            </section>
          </Reveal>
        )}

        {on(c.dress_code) && (
          <Reveal>
            <section id="vestimenta" className="jd-sec jd-center" aria-labelledby="dress-h">
              <Heading eyebrow="Vestimenta" id="dress-h">Código <em>de vestimenta</em></Heading>
              {c.dress_code.body && <p className="jd-text">{c.dress_code.body}</p>}
              {c.dress_code.quote && <blockquote className="jd-quote">{c.dress_code.quote}</blockquote>}
            </section>
          </Reveal>
        )}
      </div>

      {on(c.gifts) && (
        <div className="jd-band tpl-bleed">
          <Reveal>
            <section className="jd-wrap jd-sec jd-center" aria-labelledby="regalos-h">
              <Heading eyebrow="Con cariño" id="regalos-h">Mesa <em>de regalos</em></Heading>
              {c.gifts.body && <p className="jd-text">{c.gifts.body}</p>}
              {c.gifts.url && <p className="jd-cta"><a className="jd-btn" href={c.gifts.url} target="_blank" rel="noopener">{c.gifts.button_label || "Ver mesa de regalos"}</a></p>}
            </section>
          </Reveal>
        </div>
      )}

      <div className="jd-wrap">
        {on(c.lodging) && c.lodging.items.length > 0 && (
          <Reveal>
            <section id="hospedaje" className="jd-sec jd-center" aria-labelledby="hosp-h">
              <Heading eyebrow="Si vienes de fuera" id="hosp-h">Dónde <em>hospedarte</em></Heading>
              <div className="jd-venues">
                {c.lodging.items.map((h, i) => (
                  <article className="jd-arch-card jd-arch-card-sm" key={i}>
                    <h3>{h.name}</h3>
                    {h.address && <p className="jd-addr">{h.address}</p>}
                  </article>
                ))}
              </div>
            </section>
          </Reveal>
        )}
      </div>

      <div className="jd-band jd-band-tint tpl-bleed">
        <Reveal>
          <section id="rsvp" className="jd-wrap jd-sec jd-center" aria-labelledby="rsvp-h">
            <Heading eyebrow={event.deadlineLabel && event.status === "published" ? `Confirma antes del ${event.deadlineLabel}` : "Confirmación"} id="rsvp-h">
              ¿Nos <em>acompañas?</em>
            </Heading>
            <div className="jd-rsvp"><RsvpSlot event={event} code={code} guest={guest} /></div>
          </section>
        </Reveal>
      </div>

      <div className="jd-wrap">
        {on(c.faq) && c.faq.items.length > 0 && (
          <Reveal>
            <section id="preguntas" className="jd-sec" aria-labelledby="faq-h">
              <Heading eyebrow="Por si te lo preguntas" id="faq-h">Preguntas <em>frecuentes</em></Heading>
              <div className="jd-faq-list">
                {c.faq.items.map((f, i) => (
                  <details key={i} className="jd-faq"><summary>{f.q}</summary><p>{f.a}</p></details>
                ))}
              </div>
            </section>
          </Reveal>
        )}

        {c.footer && (
          <footer className="jd-footer">
            <div className="jd-footer-art"><Branch className="jd-br-s" leaves={6} variant={1} /><Branch className="jd-br-s" leaves={6} variant={0} flip /></div>
            {c.footer.monogram && <p className="jd-mono">{c.footer.monogram}</p>}
            {c.footer.line && <p className="jd-eyebrow">{c.footer.line}</p>}
          </footer>
        )}
      </div>
    </div>
  );
}

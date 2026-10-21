import Image from "next/image";
import { AddToCalendar } from "@/components/add-to-calendar";
import { Countdown } from "@/components/countdown";
import { Reveal } from "@/components/landing/reveal";
import { flatTitle, galleryImages, heroImage, Lines, mapsHref, MusicSlot, on, RsvpSlot } from "../shared";
import type { TemplateProps } from "../types";
import "../reset.css";
import "./moderno.css";
import { modernoFonts } from "./fonts";

// Sección numerada: el número y el título a la izquierda (fijos al desplazarse en pantallas anchas) y el contenido a la derecha.
function Block({ n, title, id, children, tone }: { n: string; title: React.ReactNode; id?: string; children: React.ReactNode; tone?: "dark" | "accent" }) {
  return (
    <Reveal>
      <section id={id} className={`md-block${tone ? ` md-${tone}` : ""}`} aria-labelledby={id ? `${id}-h` : undefined}>
        <div className="md-inner">
          <header className="md-head">
            <span className="md-num">{n}</span>
            <h2 id={id ? `${id}-h` : undefined}>{title}</h2>
          </header>
          <div className="md-body">{children}</div>
        </div>
      </section>
    </Reveal>
  );
}

// Plantilla "Moderno": tipografía grande, mucho contraste y un color vivo.
export function Moderno({ event, code, guest, preview }: TemplateProps) {
  const c = event.content;
  const title = flatTitle(event);
  const photo = heroImage(event);
  const photos = galleryImages(event);
  const short = title.replace(/\s+/g, " ").split(/\s*&\s*|\s+y\s+/i).map((n) => n.trim().charAt(0).toUpperCase()).join("&") || title;
  const ticker = [c.hero.date_label, c.hero.subtitle, title].filter(Boolean).join("  ✦  ");
  let n = 0;
  const num = () => String(++n).padStart(2, "0");

  return (
    <div className={`tpl t-moderno ${modernoFonts}`}>
      <MusicSlot event={event} preview={preview} />

      <div className="md-bar tpl-bleed">
        <div className="md-bar-in">
          <a className="md-logo" href="#inicio" aria-label="Inicio">{short}</a>
          <nav className="md-nav" aria-label="Secciones">
            {on(c.venues) && <a href="#lugares">Lugares</a>}
            {on(c.schedule) && <a href="#itinerario">Itinerario</a>}
            {on(c.faq) && <a href="#preguntas">Preguntas</a>}
          </nav>
          <a className="md-pill" href="#rsvp">Confirmar</a>
        </div>
      </div>

      <header id="inicio" className={`md-hero tpl-bleed${photo ? " has-photo" : ""}`}>
        {photo && <Image className="md-hero-img" src={photo} alt={c.hero.image_alt} fill sizes="100vw" priority />}
        <div className="md-hero-in">
          <p className="md-kicker">Nos casamos</p>
          <h1 className="md-names">{title.split(/\s+/).map((w, i) => <span key={i} className={w === "&" ? "md-amp" : undefined}>{w}</span>)}</h1>
          <div className="md-meta">
            {c.hero.date_label && <p>{c.hero.date_label}</p>}
            {c.hero.subtitle && <p>{c.hero.subtitle}</p>}
            {event.calendar && <AddToCalendar cal={event.calendar} slug={event.slug} className="md-pill md-pill-light" />}
          </div>
          <a className="md-scroll" href="#bienvenida" aria-label="Seguir">Desliza ↓</a>
        </div>
        <div className="md-marquee" aria-hidden="true">
          <div className="md-marquee-track">{[0, 1, 2, 3].map((i) => <span key={i}>{ticker}  ✦  </span>)}</div>
        </div>
      </header>

      {on(c.welcome) && (
        <Block n={num()} title={c.welcome.eyebrow || "Hola"} id="bienvenida">
          <p className="md-big"><Lines text={c.welcome.heading} />{c.welcome.heading_script && <> <em>{c.welcome.heading_script}</em></>}</p>
          {c.welcome.body && <p className="md-text">{c.welcome.body}</p>}
          {c.welcome.quote && <blockquote className="md-quote">{c.welcome.quote}</blockquote>}
        </Block>
      )}

      {on(c.countdown) && event.countdownTarget !== null && (
        <Block n={num()} title="Faltan" tone="accent">
          <Countdown target={event.countdownTarget} className="md-cd" />
          {c.countdown.date_label && <p className="md-note">{c.countdown.date_label}</p>}
        </Block>
      )}

      {photos.length > 0 && (
        <Block n={num()} title="Momentos">
          <ul className="md-gallery">
            {photos.map((img, i) => (
              <li key={img.src}>
                <Image src={img.src} alt={img.alt} width={560} height={700} sizes="(max-width: 700px) 70vw, 300px" loading={i < 2 ? "eager" : "lazy"} />
                <span>{String(i + 1).padStart(2, "0")}</span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {on(c.venues) && c.venues.items.length > 0 && (
        <Block n={num()} title="Lugares" id="lugares">
          {c.venues.eyebrow && <p className="md-note md-note-top">{c.venues.eyebrow}</p>}
          <ul className="md-rows">
            {c.venues.items.map((v, i) => (
              <li key={i}>
                <div>
                  {v.label && <p className="md-label">{v.label}</p>}
                  <h3>{v.name}</h3>
                  {v.address && <p className="md-addr">{v.address}</p>}
                  {v.map_query && <a className="md-link" href={mapsHref(v.map_query)} target="_blank" rel="noopener">Cómo llegar ↗</a>}
                </div>
                {v.time && <p className="md-time">{v.time}</p>}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {on(c.schedule) && c.schedule.items.length > 0 && (
        <Block n={num()} title="Itinerario" id="itinerario">
          <ol className="md-rows md-schedule">
            {c.schedule.items.map((it, i) => (
              <li key={i}><p className="md-time md-time-sm">{it.time}</p><h3>{it.label}</h3></li>
            ))}
          </ol>
        </Block>
      )}

      {on(c.dress_code) && (
        <Block n={num()} title="Vestimenta" id="vestimenta">
          {c.dress_code.body && <p className="md-big">{c.dress_code.body}</p>}
          {c.dress_code.quote && <blockquote className="md-quote">{c.dress_code.quote}</blockquote>}
        </Block>
      )}

      {on(c.gifts) && (
        <Block n={num()} title="Regalos">
          {c.gifts.body && <p className="md-text">{c.gifts.body}</p>}
          {c.gifts.url && <p><a className="md-pill md-pill-solid" href={c.gifts.url} target="_blank" rel="noopener">{c.gifts.button_label || "Ver mesa de regalos"} ↗</a></p>}
        </Block>
      )}

      {on(c.lodging) && c.lodging.items.length > 0 && (
        <Block n={num()} title="Hospedaje" id="hospedaje">
          <ul className="md-rows">
            {c.lodging.items.map((h, i) => (
              <li key={i}><div><h3>{h.name}</h3>{h.address && <p className="md-addr">{h.address}</p>}</div></li>
            ))}
          </ul>
        </Block>
      )}

      <Block n={num()} title={<>¿Nos <em>acompañas?</em></>} id="rsvp" tone="dark">
        {event.deadlineLabel && event.status === "published" && <p className="md-note md-note-top">Confirma antes del {event.deadlineLabel}</p>}
        <div className="md-rsvp"><RsvpSlot event={event} code={code} guest={guest} /></div>
      </Block>

      {on(c.faq) && c.faq.items.length > 0 && (
        <Block n={num()} title="Preguntas" id="preguntas">
          <div className="md-faq-list">
            {c.faq.items.map((f, i) => (
              <details key={i} className="md-faq"><summary>{f.q}</summary><p>{f.a}</p></details>
            ))}
          </div>
        </Block>
      )}

      {c.footer && (
        <footer className="md-footer tpl-bleed">
          {c.footer.monogram && <p className="md-mono">{c.footer.monogram}</p>}
          {c.footer.line && <p className="md-label">{c.footer.line}</p>}
        </footer>
      )}
    </div>
  );
}

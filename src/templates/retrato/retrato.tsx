import Image from "next/image";
import { AddToCalendar } from "@/components/add-to-calendar";
import { Countdown } from "@/components/countdown";
import { Reveal } from "@/components/landing/reveal";
import { mediaUrl } from "@/lib/event-content";
import { galleryImages, heroImage, Lines, mapsHref, MusicSlot, on, RsvpSlot } from "../shared";
import type { TemplateProps } from "../types";
import "../reset.css";
import "./retrato.css";
import { retratoFonts } from "./fonts";
import { Schedule } from "./schedule";
import { VenueImage } from "./venue-image";

function Section({ id, eyebrow, title, className, bg, children }: { id?: string; className?: string; eyebrow?: string; title?: React.ReactNode; bg?: string | null; children: React.ReactNode }) {
  return (
    <Reveal>
      <section id={id} className={`rt-sec${bg ? " rt-photo-sec tpl-bleed" : ""}${className ? ` ${className}` : ""}`} aria-labelledby={id && title ? `${id}-h` : undefined}>
        {bg && <Image className="rt-sec-img" src={bg} alt="" fill sizes="100vw" />}
        <div className="rt-wrap">
          {(eyebrow || title) && (
            <header className="rt-head">
              {eyebrow && <p className="rt-eyebrow">{eyebrow}</p>}
              {title && <h2 id={id ? `${id}-h` : undefined}>{title}</h2>}
            </header>
          )}
          {children}
        </div>
      </section>
    </Reveal>
  );
}

// Título con dos tipos de letra: la primera palabra con la fuente Ballet y el resto con la de los nombres.
function splitTitle(title: string) {
  const [first, ...rest] = title.trim().split(/\s+/);
  return rest.length ? <><span className="rt-first">{first}</span> <span className="rt-alt">{rest.join(" ")}</span></> : <span className="rt-first">{first}</span>;
}

// Plantilla "Retrato": la foto de los novios a pantalla completa con sus nombres encimados.
export function Retrato({ event, code, guest, preview }: TemplateProps) {
  const c = event.content;
  const photo = heroImage(event);
  const photos = galleryImages(event);
  // Un nombre por línea: separados por salto de línea (Enter en el editor), "&" o "y". El "&" o la "y" se muestra entre los nombres.
  const parts = (c.hero.title || event.title).split(/(\s*&\s*|\s+y\s+)|\n/i)
    .map((t) => t?.trim()).filter((t): t is string => !!t)
    .map((t) => ({ text: t, connector: /^(&|y)$/i.test(t) }));

  const showStory = !!on(c.story) && !!c.story.body.trim();
  const joined = showStory && photos.length > 0; // historia y galería van pegadas
  const bg = (image?: string) => event.demo?.venue ?? (image ? mediaUrl(image) : null); // foto de fondo de cada lugar

  return (
    <div className={`tpl t-retrato ${retratoFonts}`}>
      <header id="inicio" className={`rt-hero tpl-bleed${photo ? " has-photo" : ""}`}>
        {photo && <Image className="rt-hero-img" src={photo} alt={c.hero.image_alt} fill sizes="100vw" priority />}
        <div className="rt-hero-in">
          <p className="rt-top">Estás invitado a la boda de</p>
          <h1 className="rt-names">{parts.map((p, i) => <span key={i} className={p.connector ? "rt-conn" : undefined}>{p.text}</span>)}</h1>
          {c.hero.date_label && <p className="rt-date">{c.hero.date_label}</p>}
          {c.hero.subtitle && <p className="rt-place">{c.hero.subtitle}</p>}
          <MusicSlot event={event} preview={preview} cover={false} autoOnScroll />
          {event.calendar && <AddToCalendar cal={event.calendar} slug={event.slug} className="rt-btn rt-btn-light" />}
        </div>
        <a className="rt-scroll" href="#bienvenida" aria-label="Seguir"><span /></a>
      </header>

      {on(c.story) && c.story.body.trim() && (
        <Section id="historia" className={joined ? "rt-join-top" : undefined} title={splitTitle(c.story.title || "Nuestra historia de amor")}>
          {c.story.body.split(/\n\s*\n/).map((p, i) => <p key={i} className="rt-text rt-story">{p.trim()}</p>)}
        </Section>
      )}

      {photos.length > 0 && (
        <Section className={joined ? "rt-join-bottom" : undefined}>
          <ul className="rt-gallery">
            {photos.map((img, i) => (
              <li key={img.src}>
                <Image src={img.src} alt={img.alt} width={560} height={700} sizes="(max-width: 700px) 70vw, 300px" loading={i < 2 ? "eager" : "lazy"} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {on(c.welcome) && (
        <Section id="bienvenida" className="rt-welcome" eyebrow={c.welcome.eyebrow} title={<><Lines text={c.welcome.heading} />{c.welcome.heading_script && <> <em>{c.welcome.heading_script}</em></>}</>}>
          {c.welcome.body && <p className="rt-text">{c.welcome.body}</p>}
          {c.welcome.quote && <blockquote className="rt-quote">{c.welcome.quote}</blockquote>}
        </Section>
      )}

      {on(c.countdown) && event.countdownTarget !== null && (
        <Section eyebrow="Faltan">
          <Countdown target={event.countdownTarget} className="rt-cd" />
          {c.countdown.date_label && <p className="rt-note">{c.countdown.date_label}</p>}
        </Section>
      )}

      {on(c.venues) && c.venues.items.length > 0 && (
        <Section id="lugares" eyebrow={c.venues.eyebrow} title="Lugares">
          <ul className="rt-list">
            {c.venues.items.map((v, i) => (
              <li key={i} className={bg(v.image) ? "rt-has-bg" : undefined}>
                {bg(v.image) && <VenueImage src={bg(v.image)!} index={i} x={v.image_x} y={v.image_y} zoom={v.image_zoom} editable={!!preview && !event.demo} />}
                {v.label && <p className="rt-label">{v.label}</p>}
                <h3>{v.name}</h3>
                {v.time && <p className="rt-time">{v.time}</p>}
                {v.address && <p className="rt-addr">{v.address}</p>}
                {v.map_query && <a className="rt-link" href={mapsHref(v.map_query)} target="_blank" rel="noopener">Cómo llegar</a>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {on(c.schedule) && c.schedule.items.length > 0 && (
        <Section id="itinerario" title={splitTitle("Itinerario del gran día")}>
          <Schedule items={c.schedule.items} />
        </Section>
      )}

      {on(c.dress_code) && (
        <Section id="vestimenta" title="Vestimenta">
          {c.dress_code.body && <p className="rt-text rt-story">{c.dress_code.body}</p>}
          {c.dress_code.quote && <blockquote className="rt-quote">{c.dress_code.quote}</blockquote>}
        </Section>
      )}

      {on(c.gifts) && (
        <Section id="regalos" title="Regalos" bg={event.demo?.gifts ?? (c.gifts.image ? mediaUrl(c.gifts.image) : null)}>
          {c.gifts.body && <p className="rt-text rt-story">{c.gifts.body}</p>}
          {c.gifts.url && <p><a className={`rt-btn${event.demo?.gifts || c.gifts.image ? " rt-btn-light" : ""}`} href={c.gifts.url} target="_blank" rel="noopener">{c.gifts.button_label || "Ver mesa de regalos"}</a></p>}
        </Section>
      )}

      {on(c.lodging) && c.lodging.items.length > 0 && (
        <Section id="hospedaje" title="Hospedaje">
          <ul className="rt-list">
            {c.lodging.items.map((h, i) => (
              <li key={i}><h3>{h.name}</h3>{h.address && <p className="rt-addr">{h.address}</p>}{h.map_query && <a className="rt-link" href={mapsHref(h.map_query)} target="_blank" rel="noopener">Cómo llegar</a>}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section id="rsvp" eyebrow={event.deadlineLabel && event.status === "published" ? `Confirma antes del ${event.deadlineLabel}` : undefined} title={<>¿Nos <em>acompañas?</em></>}>
        <div className="rt-rsvp"><RsvpSlot event={event} code={code} guest={guest} /></div>
      </Section>

      {on(c.faq) && c.faq.items.length > 0 && (
        <Section id="preguntas" title="Preguntas">
          <div className="rt-faq-list">
            {c.faq.items.map((f, i) => (
              <details key={i} className="rt-faq"><summary>{f.q}</summary><p>{f.a}</p></details>
            ))}
          </div>
        </Section>
      )}

      {c.footer && (
        <footer className="rt-footer tpl-bleed">
          {c.footer.monogram && <p className="rt-mono">{c.footer.monogram}</p>}
          {c.footer.line && <p className="rt-label">{c.footer.line}</p>}
        </footer>
      )}
    </div>
  );
}

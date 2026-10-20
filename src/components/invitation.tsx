import Image from "next/image";
import { Countdown } from "./countdown";
import { MusicPlayer } from "./music-player";
import { HeroArt } from "./hero-art";
import { Rsvp } from "./rsvp";
import { audioUrl, mediaUrl, themeCss } from "@/lib/event-content";
import type { PublicEvent } from "@/lib/events";
import type { Guest } from "@/lib/rsvp-schema";

const on = <T extends { enabled: boolean }>(section: T | undefined): section is T =>
  !!section && section.enabled;

// Texto con saltos de línea (\n) -> <br>
function Lines({ text }: { text: string }) {
  return text.split("\n").map((line, i) => (
    <span key={i}>{i > 0 && <br />}{line}</span>
  ));
}

export function Invitation({ event, code, guest, preview }: { event: PublicEvent; code?: string; guest?: Guest; preview?: boolean }) {
  const { content: c, theme } = event;
  const css = themeCss(theme);

  return (
    <div className="wrap">
      {css && <style>{css}</style>}

      <header className="hero">
        <nav aria-label="Secciones">
          {on(c.venues) && <a href="#lugares">Lugares</a>}
          {on(c.schedule) && <a href="#itinerario">Itinerario</a>}
          {on(c.dress_code) && <a href="#vestimenta">Vestimenta</a>}
          <a href="#rsvp">Confirmar</a>
          {on(c.faq) && <a href="#preguntas">Preguntas</a>}
        </nav>
        {on(c.music) && c.music.path && (
          <MusicPlayer
            src={audioUrl(c.music.path)}
            title={c.music.title}
            label={c.music.button_label}
            cover={c.music.cover}
            start={c.music.start}
            end={c.music.end}
            eventTitle={c.hero.title || event.title}
            preview={preview}
          />
        )}
        <h1 className="names" style={{ marginTop: 28 }}><Lines text={c.hero.title || event.title} /></h1>
        {c.hero.date_label && <p className="date-big">{c.hero.date_label}</p>}
        {c.hero.subtitle && <p className="script">{c.hero.subtitle}</p>}
        {c.hero.image && (
          <Image
            className="hero-photo"
            src={mediaUrl(c.hero.image)}
            alt={c.hero.image_alt}
            width={1040}
            height={1300}
            sizes="(max-width: 720px) 100vw, 520px"
            priority
          />
        )}
        <HeroArt name={theme.hero_art} />
      </header>

      {on(c.welcome) && (
        <section aria-labelledby="bienvenida">
          {c.welcome.eyebrow && <p className="eyebrow" id="bienvenida">{c.welcome.eyebrow}</p>}
          <h2>
            <Lines text={c.welcome.heading} />
            {c.welcome.heading_script && <><br /><em>{c.welcome.heading_script}</em></>}
          </h2>
          {c.welcome.body && <p>{c.welcome.body}</p>}
          {c.welcome.quote && <p className="quote">{c.welcome.quote}</p>}
        </section>
      )}

      {on(c.gallery) && c.gallery.items.length > 0 && (
        <section aria-labelledby="galeria-h">
          <h2 id="galeria-h">Algunos <em>momentos</em></h2>
          <ul className="gallery">
            {c.gallery.items.map((img, i) => (
              <li key={img.path}>
                <Image
                  src={mediaUrl(img.path)}
                  alt={img.alt}
                  width={800}
                  height={800}
                  sizes="(max-width: 720px) 50vw, 240px"
                  loading={i < 2 ? "eager" : "lazy"}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {on(c.countdown) && event.countdownTarget !== null && (
        <section aria-labelledby="faltan">
          <p className="eyebrow" id="faltan">Faltan</p>
          <Countdown target={event.countdownTarget} />
          {c.countdown.date_label && <p className="note">{c.countdown.date_label}</p>}
        </section>
      )}

      {on(c.venues) && c.venues.items.length > 0 && (
        <section id="lugares" aria-labelledby="lugares-h">
          {c.venues.eyebrow && <p className="eyebrow">{c.venues.eyebrow}</p>}
          <h2 id="lugares-h">Fecha <em>y</em> lugar</h2>
          <div className="venues">
            {c.venues.items.map((v, i) => (
              <article className="venue" key={i}>
                {v.label && <p className="eyebrow">{v.label}</p>}
                <h3>{v.name}</h3>
                {v.time && <p className="time">{v.time}</p>}
                {v.address && <p className="addr">{v.address}</p>}
                {v.map_query && (
                  <a
                    href={`https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: v.map_query })}`}
                    target="_blank"
                    rel="noopener"
                  >
                    Cómo llegar →
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {on(c.schedule) && c.schedule.items.length > 0 && (
        <section id="itinerario" aria-labelledby="itin-h">
          <p className="eyebrow">El día</p>
          <h2 id="itin-h">Itinerario<br /><em>del día</em></h2>
          <ol className="timeline">
            {c.schedule.items.map((it, i) => (
              <li key={i}><time>{it.time}</time><span>{it.label}</span></li>
            ))}
          </ol>
        </section>
      )}

      {on(c.dress_code) && (
        <section id="vestimenta" aria-labelledby="dress-h">
          <h2 id="dress-h">Código <em>de vestimenta</em></h2>
          {c.dress_code.body && <p>{c.dress_code.body}</p>}
          {c.dress_code.quote && <p className="quote">{c.dress_code.quote}</p>}
        </section>
      )}

      {on(c.gifts) && (
        <section aria-labelledby="regalos-h">
          <p className="eyebrow">Mesa de regalos</p>
          <h2 id="regalos-h">Mesa <em>de regalos</em></h2>
          {c.gifts.body && <p>{c.gifts.body}</p>}
          {c.gifts.url && (
            <div className="row">
              <a className="btn ghost" href={c.gifts.url} target="_blank" rel="noopener">
                {c.gifts.button_label || "Ver mesa de regalos"}
              </a>
            </div>
          )}
        </section>
      )}

      {on(c.lodging) && c.lodging.items.length > 0 && (
        <section id="hospedaje" aria-labelledby="hosp-h">
          <p className="eyebrow">Si vienes de fuera</p>
          <h2 id="hosp-h">Dónde <em>hospedarte</em></h2>
          <div className="venues">
            {c.lodging.items.map((h, i) => (
              <article className="venue" key={i}>
                <h3>{h.name}</h3>
                {h.address && <p className="addr">{h.address}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      <section id="rsvp" aria-labelledby="rsvp-h">
        {event.deadlineLabel && event.status === "published" && (
          <p className="eyebrow">Confirma antes del {event.deadlineLabel}</p>
        )}
        <h2 id="rsvp-h">¿Nos <em>acompañas?</em></h2>
        <Rsvp
          slug={event.slug}
          initialCode={code}
          initialGuest={guest}
          calendarUrl={event.calendarUrl}
          deadlineLabel={event.deadlineLabel}
          closed={event.status === "closed"}
        />
      </section>

      {on(c.faq) && c.faq.items.length > 0 && (
        <section id="preguntas" aria-labelledby="faq-h">
          <p className="eyebrow">Por si te lo preguntas</p>
          <h2 id="faq-h">Preguntas <em>frecuentes</em></h2>
          <div>
            {c.faq.items.map((f, i) => (
              <details key={i}><summary>{f.q}</summary><p>{f.a}</p></details>
            ))}
          </div>
        </section>
      )}

      {c.footer && (
        <footer>
          {c.footer.monogram && <p className="mono">{c.footer.monogram}</p>}
          {c.footer.line && <p className="eyebrow">{c.footer.line}</p>}
        </footer>
      )}
    </div>
  );
}

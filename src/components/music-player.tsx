"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const VOLUME = 0.7;

// Música de fondo de la invitación. Los navegadores solo dejan reproducir audio tras un toque del
// invitado, por eso la pantalla de apertura ("Toca para abrir") es el momento natural para empezar.
export function MusicPlayer({ src, title, label, cover, eventTitle, preview, start = 0, end }: {
  src: string; title: string; label?: string; cover: boolean; eventTitle: string; preview?: boolean; start?: number; end?: number;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const fade = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasPlaying = useRef(false);
  const seeked = useRef(false);
  const pill = useRef<HTMLButtonElement>(null);
  const [pillVisible, setPillVisible] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [covered, setCovered] = useState(cover && !preview);

  const play = useCallback(async () => {
    const el = audio.current;
    if (!el) return;
    if (fade.current) clearInterval(fade.current);
    el.volume = 0;
    // La primera vez se salta la introducción. Con preload="none" aún no hay metadatos: se espera a tenerlos.
    if (!seeked.current && start > 0) {
      seeked.current = true;
      if (el.readyState >= 1) el.currentTime = start;
      else el.addEventListener("loadedmetadata", () => { el.currentTime = start; }, { once: true });
    }
    try {
      await el.play();
    } catch {
      setPlaying(false); // el navegador lo bloqueó: queda el botón para reintentar
      return;
    }
    setPlaying(true);
    fade.current = setInterval(() => { // entrada suave
      el.volume = Math.min(VOLUME, el.volume + 0.05);
      if (el.volume >= VOLUME && fade.current) clearInterval(fade.current);
    }, 80);
  }, [start]);

  const pause = useCallback(() => {
    if (fade.current) clearInterval(fade.current);
    audio.current?.pause();
    setPlaying(false);
  }, []);

  // Una plantilla con su propia apertura (p. ej. el sobre) avisa con este evento: ya hubo un toque, se puede reproducir.
  useEffect(() => {
    const onPlay = () => { setCovered(false); void play(); };
    window.addEventListener("sayless:play", onPlay);
    return () => window.removeEventListener("sayless:play", onPlay);
  }, [play]);

  // Con la pantalla de apertura visible no se puede desplazar la página.
  useEffect(() => {
    if (!covered) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [covered]);

  // Al cambiar de pestaña o apagar la pantalla, la música se pausa y se retoma al volver.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        wasPlaying.current = playing;
        if (playing) pause();
      } else if (wasPlaying.current) {
        wasPlaying.current = false;
        void play();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [playing, play, pause]);

  // El botón flotante solo aparece cuando la píldora de la portada ya no está a la vista.
  useEffect(() => {
    const el = pill.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setPillVisible(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => () => { if (fade.current) clearInterval(fade.current); }, []);

  return (
    <>
      <audio
        ref={audio}
        src={src}
        preload="none"
        // Sin "loop" nativo: la repetición vuelve al inicio elegido (y corta en el final, si lo hay).
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (end != null && el.currentTime >= end) el.currentTime = start;
        }}
        onEnded={(e) => { e.currentTarget.currentTime = start; void e.currentTarget.play(); }}
      />

      {covered && (
        <div className="mp-cover" role="dialog" aria-modal="true" aria-label="Abrir invitación">
          <noscript><style>{".mp-cover{display:none!important}"}</style></noscript>
          <p className="eyebrow">Estás invitado</p>
          <p className="mp-title">{eventTitle.split("\n").map((l, i) => <span key={i}>{i > 0 && <br />}{l}</span>)}</p>
          <button className="btn" onClick={() => { setCovered(false); void play(); }}>Abrir invitación ♪</button>
          <button className="mp-skip" onClick={() => setCovered(false)}>Entrar sin música</button>
        </div>
      )}

      <button
        ref={pill}
        type="button"
        className={`mp-pill${playing ? " mp-on" : ""}`}
        aria-pressed={playing}
        title={title || undefined}
        onClick={() => (playing ? pause() : void play())}
      >
        <span className="mp-bars" aria-hidden="true"><i /><i /><i /></span>
        {playing ? "Pausar música" : (label?.trim() || "Reproduce nuestra canción")}
      </button>

      {!pillVisible && !covered && (
        <button
          type="button"
          className={`mp-toggle${playing ? " mp-on" : ""}`}
          aria-label={playing ? "Pausar música" : `Reproducir música${title ? `: ${title}` : ""}`}
          aria-pressed={playing}
          title={title || "Música"}
          onClick={() => (playing ? pause() : void play())}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>
          )}
        </button>
      )}
    </>
  );
}

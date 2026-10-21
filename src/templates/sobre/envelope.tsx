"use client";

import { useEffect, useState } from "react";

// Pantalla de apertura: un sobre cerrado con sello de lacre. Al tocarlo se abre, sale la tarjeta y aparece la invitación.
// El toque también inicia la música (si hay), porque los navegadores solo la dejan reproducir tras un gesto del invitado.
export function Envelope({ title, date, seal, hasMusic }: { title: string; date: string; seal: string; hasMusic: boolean }) {
  const [phase, setPhase] = useState<"closed" | "opening" | "open">("closed");

  // Mientras el sobre está cerrado no se puede desplazar la página.
  useEffect(() => {
    if (phase === "open") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [phase]);

  function open() {
    if (phase !== "closed") return;
    if (hasMusic) window.dispatchEvent(new Event("sayless:play"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setPhase("open");
    setPhase("opening");
    setTimeout(() => setPhase("open"), 2300);
  }

  if (phase === "open") return null;

  return (
    <div className="so-overlay" data-phase={phase} role="dialog" aria-modal="true" aria-label="Abrir invitación">
      <noscript><style>{".so-overlay{display:none!important}"}</style></noscript>
      <p className="so-lead">Has recibido una invitación</p>
      <button type="button" className="so-env" onClick={open} aria-label="Abrir el sobre">
        <span className="so-back" />
        <span className="so-card">
          <small>Nos casamos</small>
          <b>{title}</b>
          <i>{date}</i>
        </span>
        <span className="so-pl" />
        <span className="so-pr" />
        <span className="so-pb" />
        <span className="so-flap" />
        <span className="so-seal"><span>{seal}</span></span>
      </button>
      <p className="so-tap">Toca el sello para abrir</p>
    </div>
  );
}

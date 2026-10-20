"use client";

import { useEffect, useState } from "react";

const SAMPLES = [
  { id: "boda", label: "Boda", eyebrow: "Nos casamos", name: "Ana & Luis", date: "14 · NOV · 2026", place: "Colima, México", days: "142" },
  { id: "xv", label: "XV años", eyebrow: "Mis XV años", name: "Sofía", date: "22 · MAR · 2027", place: "Hacienda San Antonio", days: "155" },
  { id: "bautizo", label: "Bautizo", eyebrow: "Mi bautizo", name: "Mateo", date: "09 · MAY · 2027", place: "Parroquia San Felipe", days: "203" },
  { id: "cumple", label: "Cumpleaños", eyebrow: "Cumplo 30", name: "Diego", date: "18 · JUL · 2027", place: "Terraza Los Cedros", days: "270" },
] as const;

// Celular con una invitación de ejemplo que cambia según el tipo de evento.
export function EventShowcase() {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % SAMPLES.length), 4200);
    return () => clearInterval(t);
  }, [auto]);

  const s = SAMPLES[i];
  return (
    <div className={`lp-show lp-acc-${s.id}`}>
      <div className="lp-phone">
        <div className="lp-phone-notch" aria-hidden="true" />
        <div className="lp-screen" key={s.id}>
          <span className="lp-s-eyebrow">{s.eyebrow}</span>
          <span className="lp-s-name">{s.name}</span>
          <span className="lp-s-date">{s.date}</span>
          <span className="lp-s-line" />
          <span className="lp-s-place">{s.place}</span>
          <span className="lp-s-count"><b>{s.days}</b> días</span>
          <span className="lp-s-btn">Confirmar asistencia</span>
        </div>
        <div className="lp-chip" key={`chip-${s.id}`}>✓ 3 lugares confirmados</div>
      </div>
      <div className="lp-pills" role="group" aria-label="Ver ejemplo de invitación">
        {SAMPLES.map((x, n) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={n === i}
            onClick={() => {
              setAuto(false);
              setI(n);
            }}
          >
            {x.label}
          </button>
        ))}
      </div>
    </div>
  );
}

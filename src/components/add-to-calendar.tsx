"use client";

import { useEffect, useRef, useState } from "react";
import { googleCalendarLink, type CalendarData } from "@/lib/calendar";

// "Agregar al calendario" con dos opciones: Google Calendar (enlace) y archivo .ics (Apple, Outlook y demás).
export function AddToCalendar({ cal, slug, className = "btn ghost" }: { cal: CalendarData; slug: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  return (
    <div className="cal" ref={box}>
      <button type="button" className={className} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        Agregar al calendario
      </button>
      {open && (
        <div className="cal-menu" role="menu">
          {/* La dirección de la invitación se arma aquí, en el navegador, porque es donde se conoce el dominio real. */}
          <a role="menuitem" target="_blank" rel="noopener" href={googleCalendarLink(cal, `${window.location.origin}/${slug}`)} onClick={() => setOpen(false)}>
            Google Calendar
          </a>
          <a role="menuitem" href={`/${slug}/calendario.ics`} download={`${slug}.ics`} onClick={() => setOpen(false)}>
            Apple, Outlook y otros (.ics)
          </a>
        </div>
      )}
    </div>
  );
}

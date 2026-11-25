"use client";

import { useEffect, useRef } from "react";

// Itinerario de Retrato: la línea vertical se dibuja al ritmo del desplazamiento y cada actividad entra con el efecto de
// nitidez de la portada cuando la línea llega a ella. Si se sube de nuevo, se deshace. Sin JavaScript (o con "reducir
// movimiento") la lista se ve completa desde el principio: la animación se activa después de cargar, no antes.
export function Schedule({ items }: { items: { time: string; label: string }[] }) {
  const ol = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = ol.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rows = Array.from(el.querySelectorAll("li"));
    el.dataset.anim = "1";
    let raf = 0;
    const update = () => {
      raf = 0;
      // La línea llega hasta un punto situado al 62 % de la altura de la pantalla.
      const r = el.getBoundingClientRect();
      const end = Math.max(0, Math.min(r.height, window.innerHeight * 0.62 - r.top));
      el.style.setProperty("--draw", `${end}px`);
      rows.forEach((li) => li.classList.toggle("on", end >= li.offsetTop + li.offsetHeight / 2 - 8));
    };
    const request = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    return () => {
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
      if (raf) cancelAnimationFrame(raf);
      delete el.dataset.anim;
    };
  }, [items]);

  return (
    <ol ref={ol} className="rt-schedule">
      {items.map((it, i) => (
        <li key={i}><span className="rt-time">{it.time}</span><span>{it.label}</span></li>
      ))}
    </ol>
  );
}

"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { PREVIEW_FRAME, type PreviewFrameMessage } from "@/lib/preview-message";

type Frame = { x: number; y: number; zoom: number };
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// Foto de fondo de una tarjeta de "Lugares". En la vista previa del editor se puede encuadrar directamente sobre la tarjeta:
// arrastrar mueve la foto, los botones − / + (o Ctrl + rueda) la acercan. Los cambios se avisan al editor, que los guarda en el borrador.
export function VenueImage({ src, index, x = 50, y = 50, zoom = 1, editable }: {
  src: string; index: number; x?: number; y?: number; zoom?: number; editable: boolean;
}) {
  // Mientras se arrastra se muestra el valor local (sin esperar al editor); poco después vuelve a mandar lo que diga el borrador.
  const [local, setLocal] = useState<Frame | null>(null);
  const cur = local ?? { x, y, zoom };
  const curRef = useRef<Frame>({ x, y, zoom });
  // Lo que dice el borrador se vuelve la referencia cuando no hay un valor local en curso.
  useEffect(() => { if (!local) curRef.current = { x, y, zoom }; }, [local, x, y, zoom]);
  const overlay = useRef<HTMLDivElement>(null);
  const natural = useRef<{ w: number; h: number } | null>(null);
  const drag = useRef<{ px: number; py: number; start: Frame } | null>(null);
  const release = useRef<ReturnType<typeof setTimeout> | null>(null);
  const raf = useRef<number | null>(null);

  function send(f: Frame) {
    if (window.parent === window) return; // abierta fuera del editor: no hay a quién avisar
    const msg: PreviewFrameMessage = { type: PREVIEW_FRAME, venue: index, image_x: Math.round(f.x), image_y: Math.round(f.y), image_zoom: Math.round(f.zoom * 100) / 100 };
    window.parent.postMessage(msg, window.location.origin);
  }
  function apply(f: Frame, final: boolean) {
    if (release.current) clearTimeout(release.current);
    curRef.current = f;
    setLocal(f);
    if (final) {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = null;
      send(f);
      release.current = setTimeout(() => setLocal(null), 700);
    } else if (!raf.current) {
      raf.current = requestAnimationFrame(() => { raf.current = null; send(curRef.current); });
    }
  }

  // Ctrl (o ⌘) + rueda, también el pellizco del trackpad: acerca sin quitarle a la rueda normal su función de desplazar la página.
  useEffect(() => {
    const el = overlay.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const c = curRef.current;
      apply({ ...c, zoom: clamp(c.zoom - e.deltaY * 0.01, 1, 3) }, true);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, start: curRef.current };
  }
  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const r = e.currentTarget.getBoundingClientRect();
    // Cuánto puede deslizarse la foto en cada eje: lo que sobra al cubrir la tarjeta (con un mínimo, para que no se vuelva brusco).
    const n = natural.current ?? { w: r.width, h: r.height };
    const cover = Math.max(r.width / n.w, r.height / n.h);
    const slackX = Math.max(n.w * cover - r.width, 60);
    const slackY = Math.max(n.h * cover - r.height, 60);
    // Arrastrar la foto hacia un lado = el punto visible se mueve al contrario.
    apply({
      ...d.start,
      x: clamp(d.start.x - ((e.clientX - d.px) / slackX) * 100, 0, 100),
      y: clamp(d.start.y - ((e.clientY - d.py) / slackY) * 100, 0, 100),
    }, false);
  }
  function onUp() {
    if (!drag.current) return;
    drag.current = null;
    apply(curRef.current, true);
  }
  const step = (d: number) => apply({ ...curRef.current, zoom: clamp(Math.round((curRef.current.zoom + d) * 100) / 100, 1, 3) }, true);

  const pos = `${cur.x}% ${cur.y}%`;
  return (
    <>
      <Image className="rt-venue-img" src={src} alt="" fill sizes="(max-width: 700px) 100vw, 680px" draggable={false}
        onLoad={(e) => { natural.current = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight }; }}
        style={{ objectPosition: pos, transformOrigin: pos, transform: cur.zoom > 1 ? `scale(${cur.zoom})` : undefined }} />
      {editable && (
        <div ref={overlay} className="rt-venue-edit" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <span className="rt-venue-hint">Arrastra la foto para encuadrarla</span>
          <span className="rt-venue-zoom" onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" aria-label="Alejar foto" disabled={cur.zoom <= 1} onClick={() => step(-0.25)}>−</button>
            <output>{Math.round(cur.zoom * 100)}%</output>
            <button type="button" aria-label="Acercar foto" disabled={cur.zoom >= 3} onClick={() => step(0.25)}>+</button>
          </span>
        </div>
      )}
    </>
  );
}

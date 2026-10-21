"use client";

import Image from "next/image";
import { templatesFor, type TemplateId } from "@/templates/catalog";
import type { EventType } from "@/lib/event-starter";

// Catálogo de plantillas: una tarjeta por plantilla, con su vista previa y un enlace a la demo completa.
// Se usa al crear el evento (dentro de un formulario: `name` envía la elección) y en el editor.
export function TemplatePicker({ type, value, onChange, name }: {
  type: EventType; value: TemplateId; onChange: (id: TemplateId) => void; name?: string;
}) {
  const options = templatesFor(type);
  if (options.length <= 1) return name ? <input type="hidden" name={name} value={options[0]?.id ?? "editorial"} /> : null;

  // Si la plantilla elegida no existe para este tipo de evento, se resalta la primera disponible.
  const current = options.some((t) => t.id === value) ? value : options[0].id;

  return (
    <fieldset className="tp">
      <legend>Plantilla</legend>
      {name && <input type="hidden" name={name} value={current} />}
      <div className="tp-grid" role="radiogroup" aria-label="Plantillas disponibles">
        {options.map((t) => (
          <div key={t.id} className="tp-card" data-selected={t.id === current || undefined}>
            <button type="button" role="radio" aria-checked={t.id === current} className="tp-pick" onClick={() => onChange(t.id)}>
              <Image src={`/templates/preview-${t.id}.jpg`} alt={`Vista previa de la plantilla ${t.name}`} width={280} height={495} sizes="(max-width: 600px) 45vw, 200px" />
              <span className="tp-name">{t.name}</span>
              <span className="tp-tag">{t.tagline}</span>
            </button>
            <div className="tp-meta">
              <ul>{t.traits.map((x) => <li key={x}>{x}</li>)}</ul>
              <a href={`/plantillas/${t.id}`} target="_blank" rel="noopener">Ver demo ↗</a>
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}

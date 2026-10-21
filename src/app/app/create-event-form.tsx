"use client";

import { useActionState, useState } from "react";
import { TemplatePicker } from "@/components/template-picker";
import { EVENT_TYPES, EVENT_TYPE_LABELS, slugify, type EventType } from "@/lib/event-starter";
import { isTemplateId, type TemplateId } from "@/templates/catalog";
import { createEvent, type CreateEventState } from "./actions";

export function CreateEventForm({ initialTemplate }: { initialTemplate?: string }) {
  const [state, action, pending] = useActionState<CreateEventState, FormData>(createEvent, {});
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [type, setType] = useState<EventType>("boda");
  const [template, setTemplate] = useState<TemplateId>(isTemplateId(initialTemplate) ? initialTemplate : "editorial");

  return (
    <form action={action} className="adm-card">
      <h2>Nuevo evento</h2>
      <div className="adm-grid">
        <label>Nombre del evento
          <input
            name="title" required minLength={2} maxLength={120} placeholder="Ana & Luis" value={title}
            onChange={(e) => { setTitle(e.target.value); if (!slugEdited) setSlug(slugify(e.target.value)); }}
          />
        </label>
        <label>Tipo
          <select name="type" value={type} onChange={(e) => setType(e.target.value as EventType)} className="adm-select">
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>)}
          </select>
        </label>
        <label>Fecha (opcional)
          <input name="eventDate" type="date" />
        </label>
      </div>
      <TemplatePicker type={type} value={template} onChange={setTemplate} name="template" />
      <label>Dirección de tu invitación
        <input
          name="slug" required minLength={3} maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug}
          onChange={(e) => { setSlug(e.target.value.toLowerCase()); setSlugEdited(true); }}
        />
        <small className="adm-hint">Quedará como /{slug || "tu-evento"}</small>
      </label>
      {state.error && <p className="adm-err" role="alert">{state.error}</p>}
      <button className="adm-btn" disabled={pending}>{pending ? "Creando…" : "Crear evento"}</button>
    </form>
  );
}

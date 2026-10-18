"use client";

import { useActionState, useState } from "react";
import { EVENT_TYPES, EVENT_TYPE_LABELS, slugify } from "@/lib/event-starter";
import { createEvent, type CreateEventState } from "./actions";

export function CreateEventForm() {
  const [state, action, pending] = useActionState<CreateEventState, FormData>(createEvent, {});
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

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
          <select name="type" defaultValue="boda" className="adm-select">
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>)}
          </select>
        </label>
        <label>Fecha (opcional)
          <input name="eventDate" type="date" />
        </label>
      </div>
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

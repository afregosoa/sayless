"use client";

import { useActionState, useState } from "react";
import { EVENT_TYPES, EVENT_TYPE_LABELS, slugify } from "@/lib/event-starter";
import { createClientEvent, type AdminFormState } from "./actions";

export function CreateClientEventForm({ email }: { email?: string }) {
  const [state, action, pending] = useActionState<AdminFormState, FormData>(createClientEvent, {});
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  return (
    <form action={action} className="adm-card">
      <h2>Crear evento para un cliente</h2>
      <div className="adm-grid">
        <label>Correo del cliente
          <input name="email" type="email" required defaultValue={email} readOnly={!!email} />
        </label>
        <label>Nombre del evento
          <input name="title" required minLength={2} maxLength={120} value={title}
            onChange={(e) => { setTitle(e.target.value); if (!slugEdited) setSlug(slugify(e.target.value)); }} />
        </label>
        <label>Tipo
          <select name="type" defaultValue="boda" className="adm-select">
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>)}
          </select>
        </label>
        <label>Fecha (opcional)<input name="eventDate" type="date" /></label>
      </div>
      <label>Dirección
        <input name="slug" required minLength={3} maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug}
          onChange={(e) => { setSlug(e.target.value.toLowerCase()); setSlugEdited(true); }} />
      </label>
      {state.error && <p className="adm-err" role="alert">{state.error}</p>}
      {state.ok && <p className="adm-ok" role="status">{state.ok}</p>}
      <button className="adm-btn" disabled={pending}>{pending ? "Creando…" : "Crear evento"}</button>
    </form>
  );
}

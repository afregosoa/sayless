"use client";

import { useState, useTransition } from "react";
import { assignOwner, deleteEvent, setEventPaid, setEventStatus } from "./actions";

export function EventControls({ id, slug, status, paid }: { id: string; slug: string; status: string; paid: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const res = await fn();
      setError(res.ok ? null : (res.error ?? "Error"));
    });

  return (
    <div className="adm-controls">
      <select
        className="adm-select"
        value={status}
        disabled={pending}
        aria-label="Estado"
        onChange={(e) => run(() => setEventStatus(id, e.target.value))}
      >
        <option value="draft">Borrador</option>
        <option value="published">Publicado</option>
        <option value="closed">Cerrado</option>
      </select>
      <div className="adm-actions">
        <button
          type="button"
          className="adm-link"
          disabled={pending}
          onClick={() => {
            if (paid && !confirm("Quitar el pago también regresa el evento a borrador. ¿Continuar?")) return;
            run(() => setEventPaid(id, !paid));
          }}
        >
          {paid ? "Quitar pago" : "Marcar pagado"}
        </button>
        <button
          type="button"
          className="adm-link"
          disabled={pending}
          onClick={() => {
            const to = prompt("Correo del nuevo dueño. Si aún no se registró, el evento queda reservado para cuando entre.");
            if (to) run(() => assignOwner(id, to));
          }}
        >
          Asignar dueño
        </button>
        <button
          type="button"
          className="adm-link adm-danger"
          disabled={pending}
          onClick={() => {
            const typed = prompt(`Se borrará el evento, sus invitados y sus fotos. Esto no se puede deshacer.\\nEscribe la dirección para confirmar: ${slug}`);
            if (typed !== null) run(() => deleteEvent(id, typed));
          }}
        >
          Eliminar
        </button>
      </div>
      {error && <small className="adm-err" role="alert">{error}</small>}
    </div>
  );
}

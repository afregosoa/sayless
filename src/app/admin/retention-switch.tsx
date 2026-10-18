"use client";

import { useState, useTransition } from "react";
import { setRetentionEnabled } from "./actions";

export function RetentionSwitch({ enabled }: { enabled: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="adm-card">
      <h2>Borrado automático de datos</h2>
      <p className="adm-hint">
        90 días después de la fecha de cada evento se borran nombre, teléfono y mensaje de sus invitados. Mientras esté
        apagado no se borra nada. Enciéndelo cuando ya avises a los clientes por correo antes del borrado.
      </p>
      <div className="adm-actions">
        <span className={`adm-tag ${enabled ? "adm-yes" : ""}`}>{enabled ? "Encendido" : "Apagado"}</span>
        <button
          type="button"
          className="adm-btn adm-ghost"
          disabled={pending}
          onClick={() => {
            if (!enabled && !confirm("Se borrarán los datos de invitados de TODOS los eventos con más de 90 días desde su fecha. ¿Encender?")) return;
            start(async () => {
              const res = await setRetentionEnabled(!enabled);
              setError(res.ok ? null : res.error);
            });
          }}
        >
          {enabled ? "Apagar" : "Encender"}
        </button>
      </div>
      {error && <p className="adm-err" role="alert">{error}</p>}
    </div>
  );
}

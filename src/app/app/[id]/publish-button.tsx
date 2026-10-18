"use client";

import { useState, useTransition } from "react";
import { startCheckout } from "./actions";

export function PublishButton({ eventId, priceLabel }: { eventId: string; priceLabel: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="adm-publish">
      <button
        type="button"
        className="adm-btn"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            // Si todo va bien, la acción redirige a Stripe y no regresa.
            const res = await startCheckout(eventId);
            if (res?.error) setError(res.error);
          })
        }
      >
        {pending ? "Redirigiendo al pago…" : priceLabel ? `Publicar · ${priceLabel}` : "Publicar"}
      </button>
      <small className="adm-hint">
        Pago único por evento. Después puedes seguir editando y administrando invitados sin costo adicional.
      </small>
      {error && <p className="adm-err" role="alert">{error}</p>}
    </div>
  );
}

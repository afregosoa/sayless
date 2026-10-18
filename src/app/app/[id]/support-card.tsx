"use client";

import { useState, useTransition } from "react";
import { setSupportAccess } from "./actions";

export function SupportCard({ eventId, until }: { eventId: string; until: string | null }) {
  const [days, setDays] = useState(7);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const run = (d: number) =>
    start(async () => {
      const res = await setSupportAccess(eventId, d);
      setMsg(res.error ? { ok: false, text: res.error } : { ok: true, text: res.ok ?? "" });
    });

  return (
    <div className="adm-card">
      <h2>Soporte</h2>
      {until ? (
        <>
          <p>
            El equipo de soporte puede ver tus invitados y editar tu evento hasta{" "}
            <time dateTime={until} suppressHydrationWarning>{new Date(until).toLocaleString("es-MX")}</time>.
            Todo lo que haga queda en el registro de actividad.
          </p>
          <button type="button" className="adm-btn adm-ghost" disabled={pending} onClick={() => run(0)}>
            Revocar acceso ahora
          </button>
        </>
      ) : (
        <>
          <p className="adm-hint">
            Por privacidad, el soporte no puede ver tus invitados. Si necesitas ayuda, puedes darle acceso temporal.
          </p>
          <div className="adm-actions">
            <select className="adm-select" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Duración">
              <option value={1}>1 día</option>
              <option value={7}>7 días</option>
              <option value={30}>30 días</option>
            </select>
            <button type="button" className="adm-btn" disabled={pending} onClick={() => run(days)}>
              Dar acceso a soporte
            </button>
          </div>
        </>
      )}
      {msg && <p className={msg.ok ? "adm-ok" : "adm-err"} role="status">{msg.text}</p>}
    </div>
  );
}

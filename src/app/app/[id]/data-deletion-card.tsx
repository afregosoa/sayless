"use client";

import { useState, useTransition } from "react";
import { anonymizeGuests } from "./actions";

export function DataDeletionCard({ eventId, retentionDate }: { eventId: string; retentionDate: string | null }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="adm-card">
      <h2>Datos de tus invitados</h2>
      <p className="adm-hint">
        {retentionDate
          ? `Por privacidad, el ${retentionDate} se eliminarán automáticamente los nombres, teléfonos y mensajes de tus invitados. Descarga tu lista (Exportar CSV) antes si la necesitas. `
          : "Los datos de tus invitados son tuyos. "}
        Si prefieres, puedes borrarlos ahora mismo.
      </p>
      {!open ? (
        <button type="button" className="adm-btn adm-ghost" onClick={() => setOpen(true)}>Borrar datos ahora…</button>
      ) : (
        <div className="adm-edit">
          <p>
            Se borrarán el <b>nombre, teléfono y mensaje</b> de todos los invitados. Se conservan solo los conteos.
            Los enlaces personales dejarán de funcionar. <b>No se puede deshacer.</b>
          </p>
          <label>Escribe BORRAR para confirmar
            <input value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
          </label>
          <div className="adm-actions">
            <button
              type="button"
              className="adm-btn"
              disabled={pending || text.trim().toUpperCase() !== "BORRAR"}
              onClick={() =>
                start(async () => {
                  const res = await anonymizeGuests(eventId, text);
                  setMsg(res.error ? { ok: false, text: res.error } : { ok: true, text: res.ok ?? "" });
                  if (!res.error) { setOpen(false); setText(""); }
                })
              }
            >
              {pending ? "Borrando…" : "Borrar definitivamente"}
            </button>
            <button type="button" className="adm-btn adm-ghost" onClick={() => { setOpen(false); setText(""); }}>Cancelar</button>
          </div>
        </div>
      )}
      {msg && <p className={msg.ok ? "adm-ok" : "adm-err"} role="status">{msg.text}</p>}
    </div>
  );
}

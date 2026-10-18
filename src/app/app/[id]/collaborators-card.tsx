"use client";

import { useState, useTransition } from "react";
import { cancelInvite, inviteCollaborator, removeCollaborator, type FormState } from "./actions";

type Props = {
  eventId: string;
  members: { userId: string; email: string }[];
  invites: string[];
};

export function CollaboratorsCard({ eventId, members, invites }: Props) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<FormState>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      setMsg(res.error ? { ok: false, text: res.error } : { ok: true, text: res.ok ?? "" });
      if (!res.error) after?.();
    });

  return (
    <div className="adm-card">
      <h2>Colaboradores</h2>
      <p className="adm-hint">
        Pueden editar la invitación, las fotos y los invitados. Tú sigues siendo el único que administra el pago y el
        acceso de soporte.
      </p>

      {(members.length > 0 || invites.length > 0) && (
        <ul className="adm-plain">
          {members.map((m) => (
            <li key={m.userId} className="adm-member">
              <span>{m.email}</span>
              <button type="button" className="adm-link adm-danger" disabled={pending}
                onClick={() => confirm(`¿Quitar a ${m.email}?`) && run(() => removeCollaborator(eventId, m.userId))}>
                Quitar
              </button>
            </li>
          ))}
          {invites.map((e) => (
            <li key={e} className="adm-member">
              <span>{e} <small className="adm-hint">· pendiente de iniciar sesión</small></span>
              <button type="button" className="adm-link adm-danger" disabled={pending}
                onClick={() => run(() => cancelInvite(eventId, e))}>
                Cancelar
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="adm-actions"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => inviteCollaborator(eventId, email), () => setEmail(""));
        }}
      >
        <input type="email" required placeholder="correo@ejemplo.com" aria-label="Correo del colaborador"
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="adm-btn" disabled={pending}>Invitar</button>
      </form>
      {msg && <p className={msg.ok ? "adm-ok" : "adm-err"} role="status">{msg.text}</p>}
    </div>
  );
}

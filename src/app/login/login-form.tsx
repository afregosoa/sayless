"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, {});

  if (state.sent) {
    return (
      <div className="adm-card adm-login">
        <h1>Revisa tu correo</h1>
        <p>Enviamos un enlace de acceso a <b>{state.sent}</b>. Ábrelo en este mismo navegador para entrar.</p>
        <p className="adm-hint">Si no llega en un minuto, revisa spam.</p>
      </div>
    );
  }

  return (
    <form action={action} className="adm-card adm-login">
      <h1>Entrar</h1>
      <p className="adm-hint">Te enviaremos un enlace por correo. Sin contraseña.</p>
      <input type="hidden" name="next" value={next ?? ""} />
      <label htmlFor="email">Correo</label>
      <input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      {state.error && <p className="adm-err" role="alert">{state.error}</p>}
      <button className="adm-btn" disabled={pending}>{pending ? "Enviando…" : "Enviar enlace"}</button>
    </form>
  );
}
